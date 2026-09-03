import { collectRun, type AgentRuntime } from '@bunker-studio/agent-runtime';
import { evaluateBudgetPolicies } from '@bunker-studio/core';
import {
  buildMeetingContributionPrompt,
  buildMeetingMinutesPrompt,
  fallbackMeetingMinutes,
  parseMeetingMinutes,
  runBoundedMeeting,
} from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import {
  getWebAgentRepository,
  getWebAgentRuntime,
  getWebOperationalRepository,
} from '../../../_data';

const DEFAULT_CONTRIBUTION_ESTIMATED_COST = 0.01;

function contributionEstimatedCost(): number {
  const value = Number(
    process.env.MEETING_CONTRIBUTION_ESTIMATED_COST ?? DEFAULT_CONTRIBUTION_ESTIMATED_COST,
  );
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CONTRIBUTION_ESTIMATED_COST;
}

/**
 * Runs a meeting as a bounded workflow.
 *
 * Participants speak through their own provider binding, and the Lead drafts
 * the minutes, but nothing a model says is trusted structurally: the minutes
 * are parsed deterministically and an unusable draft falls back to recording no
 * decisions rather than inventing agreement that never happened.
 */
export async function POST(request: Request, context: { params: Promise<{ meetingId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { meetingId } = await context.params;
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const agents = await getWebAgentRepository();
  if (!operations || !agents)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const meeting = await operations.getMeeting(organizationId, meetingId, actorId);
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (meeting.status === 'COMPLETED') return NextResponse.json({ meeting });
  if (!meeting.agentIds.length)
    return NextResponse.json(
      { error: 'A meeting needs at least one participant.' },
      { status: 400 },
    );

  const unitCost = contributionEstimatedCost();
  const runId = crypto.randomUUID();
  // Price the worst case up front: every participant speaking every allowed
  // round, plus the Lead drafting the minutes.
  const maxRounds = Math.max(1, Math.min(meeting.maxRounds, 3));
  const estimatedCost = unitCost * (meeting.agentIds.length * maxRounds + 1);
  const budget = evaluateBudgetPolicies({
    policies: await operations.listBudgetPolicies(organizationId, actorId),
    entries: await operations.listCosts(organizationId, actorId),
    estimatedCost,
    context: { runId },
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
              ? 'Meeting blocked by hard budget'
              : 'Meeting requires budget approval',
          body: `"${meeting.title}" cannot run until the budget policy is resolved.`,
          deepLink: `/meetings`,
        },
        actorId,
      ),
    );
    return NextResponse.json(
      { error: 'Budget policy prevents running this meeting.', budget },
      { status: 409 },
    );
  }

  const agentRepository = agents;
  const tenantId = organizationId;
  const actor = actorId;
  const runtimes = new Map<string, { runtime: AgentRuntime; title: string }>();
  async function participant(agentId: string) {
    const cached = runtimes.get(agentId);
    if (cached) return cached;
    const agent = await agentRepository.getAgent(agentId, tenantId, actor);
    const runtime = await getWebAgentRuntime(agent);
    if (!runtime) throw new Error(`No provider runtime is configured for "${agent.title}".`);
    const entry = { runtime, title: agent.title };
    runtimes.set(agentId, entry);
    return entry;
  }

  const running = { ...meeting, status: 'RUNNING' as const };
  await operations.updateMeeting(organizationId, running, actorId);

  let spokenTurns = 0;
  let provider = 'internal';
  try {
    const result = await runBoundedMeeting({
      agentIds: meeting.agentIds,
      maxRounds: meeting.maxRounds,
      contribute: async (agentId, round, boundedContext) => {
        const { runtime, title } = await participant(agentId);
        const run = await collectRun(runtime, {
          agentId,
          prompt: buildMeetingContributionPrompt({
            agentTitle: title,
            meetingTitle: meeting.title,
            agenda: meeting.agenda,
            round,
            boundedContext,
          }),
          correlationId: `${runId}-${agentId}-${round}`,
        });
        spokenTurns += 1;
        provider = run.provider;
        return run.text;
      },
      shouldContinue: (contributions) => contributions.length < meeting.agentIds.length * 2,
    });

    // The first participant is the Lead for the purpose of closing the meeting.
    const leadAgentId = meeting.agentIds[0]!;
    let minutes = fallbackMeetingMinutes(result.distilledContext);
    try {
      const { runtime } = await participant(leadAgentId);
      const draft = await collectRun(runtime, {
        agentId: leadAgentId,
        prompt: buildMeetingMinutesPrompt({
          meetingTitle: meeting.title,
          agenda: meeting.agenda,
          contributions: result.contributions,
          participantAgentIds: meeting.agentIds,
        }),
        correlationId: `${runId}-minutes`,
      });
      spokenTurns += 1;
      provider = draft.provider;
      const parsed = parseMeetingMinutes(draft.text, meeting.agentIds);
      if (parsed.ok) minutes = parsed.minutes;
    } catch {
      // Keep the fallback minutes: the contributions are still recorded.
    }

    const cost = Number((spokenTurns * unitCost).toFixed(4));
    const completed = await operations.updateMeeting(
      organizationId,
      { ...running, status: 'COMPLETED', contributions: result.contributions, minutes, cost },
      actorId,
    );
    await operations.addCost(
      {
        organizationId,
        amount: cost,
        occurredAt: new Date().toISOString(),
        provider,
        model: 'bounded-meeting',
        meetingId: meeting.id,
        runId,
      },
      actorId,
    );
    return NextResponse.json({ meeting: completed });
  } catch (error) {
    // Charge for the turns that did happen and leave the meeting re-runnable
    // rather than stranding it in RUNNING.
    const cost = Number((spokenTurns * unitCost).toFixed(4));
    if (cost > 0)
      await operations.addCost(
        {
          organizationId,
          amount: cost,
          occurredAt: new Date().toISOString(),
          provider,
          model: 'bounded-meeting',
          meetingId: meeting.id,
          runId,
        },
        actorId,
      );
    await operations.updateMeeting(organizationId, { ...meeting, status: 'DRAFT', cost }, actorId);
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Agent access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'The meeting could not be completed.' }, { status: 502 });
  }
}
