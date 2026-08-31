import { collectRun } from '@bunker-studio/agent-runtime';
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
  try {
    const agent = await store.getAgent(agentId, organizationId, actorId);
    const runtime = getWebAgentRuntime(agent.providerBindingId);
    if (!runtime)
      return NextResponse.json({ error: 'Provider runtime is not configured.' }, { status: 503 });
    const input = chatMessageSchema.parse(await request.json());
    const runId = crypto.randomUUID();
    const estimatedCost = chatEstimatedCost();
    const budget = evaluateBudgetPolicies({
      policies: await operations.listBudgetPolicies(organizationId, actorId),
      entries: await operations.listCosts(organizationId, actorId),
      estimatedCost,
      context: { agentId, runId },
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
    const result = await collectRun(runtime, {
      agentId: agent.id,
      prompt: `${agent.title}: ${input.content}`,
      sessionId: input.sessionId,
      correlationId: crypto.randomUUID(),
      capabilities: {
        skills: agent.skills,
        tools: agent.tools,
        permissions: agent.permissions,
      },
    });
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
    await operations.addCost(
      {
        organizationId,
        amount: estimatedCost,
        occurredAt: new Date().toISOString(),
        provider: result.provider,
        model: process.env.AGENT_PROVIDER_MODEL || agent.providerBindingId,
        agentId: agent.id,
        runId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      actorId,
    );
    return NextResponse.json({
      message: { role: 'assistant', content: result.text },
      sessionId: result.sessionId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Agent access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid chat message.' }, { status: 400 });
  }
}
