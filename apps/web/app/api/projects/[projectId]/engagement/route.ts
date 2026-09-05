import { collectRun } from '@bunker-studio/agent-runtime';
import { engagementMessageSchema } from '@bunker-studio/contracts';
import { evaluateBudgetPolicies } from '@bunker-studio/core';
import {
  buildEngagementPrompt,
  findPlaybook,
  parseEngagementReply,
  unavailableStages,
  type EngagementTurn,
} from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import {
  BRIEF_MEMORY_PREFIX,
  engagementContext,
  engagementSession,
  projectLead,
} from '../../../_engagement';
import { getWebAgentRuntime } from '../../../_data';

type Context = { params: Promise<{ projectId: string }> };

const DEFAULT_ENGAGEMENT_COST = 0.02;

function engagementCost(): number {
  const value = Number(process.env.ENGAGEMENT_ESTIMATED_COST ?? DEFAULT_ENGAGEMENT_COST);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_ENGAGEMENT_COST;
}

/** Capabilities the studio can actually perform today. */
const AVAILABLE_STAGE_CAPABILITIES: [] = [];

async function turnsOf(
  context: Extract<Awaited<ReturnType<typeof engagementContext>>, { ok: true }>,
  leadId: string,
): Promise<EngagementTurn[]> {
  const session = engagementSession(context.project.id);
  const messages = await context.operations.listAgentChatMessages(
    context.organizationId,
    leadId,
    context.actorId,
  );
  return messages
    .filter((message) => message.sessionId === session)
    .map((message) => ({
      role: message.role === 'USER' ? ('USER' as const) : ('LEAD' as const),
      content: message.content,
    }));
}

/** The conversation so far, and the brief the user has already approved. */
export async function GET(request: Request, routeContext: Context): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const context = await engagementContext(request, projectId);
  if (!context.ok) return context.response;
  try {
    const lead = await projectLead(context);
    const memories = await context.operations.listMemories(context.organizationId, context.actorId);
    const approved = memories
      .filter(
        (memory) =>
          memory.projectId === projectId && memory.content.startsWith(BRIEF_MEMORY_PREFIX),
      )
      .at(-1);
    return NextResponse.json({
      lead: lead ? { id: lead.id, name: lead.name, title: lead.title } : null,
      turns: lead ? await turnsOf(context, lead.id) : [],
      approvedBrief: approved
        ? (JSON.parse(approved.content.slice(BRIEF_MEMORY_PREFIX.length)) as unknown)
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `The conversation could not be read. ${
          error instanceof Error ? error.message : 'Unknown failure.'
        }`,
      },
      { status: 500 },
    );
  }
}

/** One turn: the user speaks, the Lead answers with a structured brief. */
export async function POST(request: Request, routeContext: Context): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const context = await engagementContext(request, projectId);
  if (!context.ok) return context.response;
  const { organizationId, actorId, operations } = context;

  let input: ReturnType<typeof engagementMessageSchema.parse>;
  try {
    input = engagementMessageSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Write something to send.' }, { status: 400 });
  }

  try {
    const lead = await projectLead(context);
    if (!lead)
      return NextResponse.json(
        {
          error:
            'This project has no Lead. Put an agent whose role is lead on the project, and it can take the brief.',
        },
        { status: 409 },
      );
    const agent = await context.agents.getAgent(lead.id, organizationId, actorId);
    const runtime = await getWebAgentRuntime(agent);
    if (!runtime)
      return NextResponse.json({ error: 'Provider runtime is not configured.' }, { status: 503 });

    const estimatedCost = engagementCost();
    const budget = evaluateBudgetPolicies({
      policies: await operations.listBudgetPolicies(organizationId, actorId),
      entries: await operations.listCosts(organizationId, actorId),
      estimatedCost,
      context: { projectId, agentId: lead.id },
    });
    if (budget.decision !== 'ALLOW')
      return NextResponse.json(
        { error: 'Budget policy prevents continuing this conversation.', budget },
        { status: 409 },
      );

    const repository = await Promise.resolve(
      operations.getRepository(projectId, organizationId, actorId),
    ).catch(() => null);
    const correlationId = crypto.randomUUID();
    // The run is opened before the provider is called: the cost ledger points at
    // it by foreign key, so an unrecorded run loses the answer with it.
    const run = await operations.startAgentRun(
      { organizationId, agentId: lead.id, correlationId },
      actorId,
    );
    let result: Awaited<ReturnType<typeof collectRun>>;
    try {
      result = await collectRun(runtime, {
        agentId: lead.id,
        correlationId,
        prompt: buildEngagementPrompt({
          agentTitle: agent.title,
          projectName: context.project.name,
          repository: repository ? `${repository.owner}/${repository.name}` : null,
          turns: await turnsOf(context, lead.id),
          message: input.content,
        }),
        capabilities: { skills: agent.skills, tools: agent.tools, permissions: agent.permissions },
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
    await Promise.resolve(
      operations.addCost(
        {
          organizationId,
          amount: estimatedCost,
          occurredAt: new Date().toISOString(),
          provider: result.provider,
          model: agent.providerModelId,
          agentId: lead.id,
          runId: run.id,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
        actorId,
      ),
    ).catch(() => undefined);

    const outcome = parseEngagementReply(result.text);
    if (!outcome.ok)
      return NextResponse.json(
        { error: `The Lead did not answer usefully. ${outcome.reason}` },
        { status: 502 },
      );

    // What is kept is what a person would re-read, not the JSON envelope.
    const spoken = [
      outcome.brief.understanding,
      ...(outcome.brief.questions.length
        ? ['', ...outcome.brief.questions.map((question) => `• ${question}`)]
        : []),
    ].join('\n');
    await operations.recordChat(
      {
        organizationId,
        agentId: lead.id,
        externalSessionId: engagementSession(projectId),
        userContent: input.content,
        assistantContent: spoken,
        provider: result.provider,
      },
      actorId,
    );

    const playbook = findPlaybook(outcome.brief.playbookKey);
    return NextResponse.json({
      brief: outcome.brief,
      spoken,
      playbook: playbook
        ? {
            key: playbook.key,
            name: playbook.name,
            summary: playbook.summary,
            stages: playbook.stages.map((stage) => ({
              key: stage.key,
              name: stage.name,
              roleKey: stage.roleKey,
              gate: stage.gate,
              optional: stage.optional,
            })),
            // Said now, not when the studio reaches a stage it cannot run.
            unavailable: unavailableStages(playbook, AVAILABLE_STAGE_CAPABILITIES).map((entry) => ({
              stage: entry.stage.name,
              missing: entry.missing,
            })),
          }
        : null,
      ...(outcome.correctedPlaybook
        ? {
            notice:
              'The Lead named a way of working the studio does not have; the default was used.',
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Project access denied.' }, { status: 403 });
    return NextResponse.json(
      {
        error: `The Lead could not answer. ${
          error instanceof Error
            ? error.message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
            : 'Unknown failure.'
        }`,
      },
      { status: 502 },
    );
  }
}
