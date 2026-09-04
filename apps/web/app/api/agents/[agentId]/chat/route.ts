import { collectRun, RuntimeError } from '@bunker-studio/agent-runtime';
import { chatMessageSchema } from '@bunker-studio/contracts';
import { evaluateBudgetPolicies } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import {
  getWebAgentRepository,
  getWebAgentRuntime,
  getWebOperationalRepository,
} from '../../../_data';

const DEFAULT_CHAT_ESTIMATED_COST = 0.01;

function chatEstimatedCost(): number {
  const value = Number(process.env.AGENT_CHAT_ESTIMATED_COST ?? DEFAULT_CHAT_ESTIMATED_COST);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CHAT_ESTIMATED_COST;
}

export async function POST(request: Request, context: { params: Promise<{ agentId: string }> }) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  const { agentId } = await context.params;
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const store = await getWebAgentRepository();
  const operations = await getWebOperationalRepository();
  if (!store || !operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  // Parsed before anything else so a malformed body is the only thing that can
  // produce a 400. A provider that cannot be reached is not a bad request.
  let input: ReturnType<typeof chatMessageSchema.parse>;
  try {
    input = chatMessageSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid chat message.' }, { status: 400 });
  }
  try {
    const agent = await store.getAgent(agentId, organizationId, actorId);
    const runtime = await getWebAgentRuntime(agent);
    if (!runtime)
      return NextResponse.json({ error: 'Provider runtime is not configured.' }, { status: 503 });
    const correlationId = crypto.randomUUID();
    const estimatedCost = chatEstimatedCost();
    const budget = evaluateBudgetPolicies({
      policies: await operations.listBudgetPolicies(organizationId, actorId),
      entries: await operations.listCosts(organizationId, actorId),
      estimatedCost,
      context: { agentId, runId: correlationId },
    });
    if (budget.decision !== 'ALLOW') {
      await Promise.resolve(
        operations.addNotification(
          {
            organizationId,
            userId: actorId,
            category: 'BUDGET',
            severity: budget.decision === 'HARD_STOP' ? 'CRITICAL' : 'HIGH',
            title:
              budget.decision === 'HARD_STOP'
                ? 'Chat blocked by hard budget'
                : 'Chat requires budget approval',
            body: `A chat run for "${agent.title}" cannot start until the budget policy is resolved.`,
            deepLink: `/agents/${agent.id}`,
          },
          actorId,
        ),
      );
      return NextResponse.json(
        { error: 'Budget policy prevents starting this chat.', budget },
        { status: 409 },
      );
    }
    if (budget.softLimitExceeded.length > 0) {
      await Promise.resolve(
        operations.addNotification(
          {
            organizationId,
            userId: actorId,
            category: 'BUDGET',
            severity: 'LOW',
            title: 'Chat soft budget threshold reached',
            body: `The chat with "${agent.title}" is starting above a configured soft budget threshold.`,
            deepLink: `/agents/${agent.id}`,
          },
          actorId,
        ),
      );
    }
    // The run is recorded before the provider is called: the cost ledger
    // references it by foreign key, so a ledger entry naming a run that was
    // never stored is rejected and the answer would be lost with it.
    const run = await operations.startAgentRun(
      { organizationId, agentId: agent.id, correlationId },
      actorId,
    );
    let result: Awaited<ReturnType<typeof collectRun>>;
    try {
      result = await collectRun(runtime, {
        agentId: agent.id,
        prompt: `${agent.title}: ${input.content}`,
        sessionId: input.sessionId,
        correlationId,
        capabilities: {
          skills: agent.skills,
          tools: agent.tools,
          permissions: agent.permissions,
        },
      });
    } catch (error) {
      await Promise.resolve(
        operations.finishAgentRun(organizationId, run.id, 'FAILED', undefined, actorId),
      ).catch(() => undefined);
      throw error;
    }
    await Promise.resolve(
      operations.finishAgentRun(organizationId, run.id, 'COMPLETED', result.sessionId, actorId),
    ).catch(() => undefined);
    await operations.recordChat(
      {
        organizationId,
        agentId: agent.id,
        externalSessionId: result.sessionId,
        userContent: input.content,
        assistantContent: result.text,
        provider: result.provider,
      },
      actorId,
    );
    // The answer has already been paid for. If the ledger write fails, say so
    // instead of discarding a reply the user has been charged for.
    let warning: string | undefined;
    try {
      await operations.addCost(
        {
          organizationId,
          amount: estimatedCost,
          occurredAt: new Date().toISOString(),
          provider: result.provider,
          model: agent.providerModelId,
          agentId: agent.id,
          runId: run.id,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
        actorId,
      );
    } catch (error) {
      warning = `The agent answered, but the cost of this reply could not be recorded: ${
        error instanceof Error ? error.message : 'unknown failure'
      }`;
    }
    return NextResponse.json({
      message: { role: 'assistant', content: result.text },
      sessionId: result.sessionId,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Agent access denied.' }, { status: 403 });
    // Say what actually failed: a silent "invalid message" hides an unreachable
    // provider, a rejected key or an exhausted quota.
    const detail =
      error instanceof RuntimeError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Unknown provider failure.';
    return NextResponse.json(
      {
        error: `The agent could not answer. ${detail.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')}`,
      },
      { status: 502 },
    );
  }
}
