import { runBoundedMeeting } from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebAgentRepository, getWebOperationalRepository } from '../../../_data';

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

  const running = { ...meeting, status: 'RUNNING' as const };
  await operations.updateMeeting(organizationId, running, actorId);
  const result = await runBoundedMeeting({
    agentIds: meeting.agentIds,
    maxRounds: meeting.maxRounds,
    contribute: async (agentId, round, boundedContext) => {
      const agent = await agents.getAgent(agentId, organizationId, actorId);
      return `${agent.title} contribution for "${meeting.title}" round ${round}. Context: ${boundedContext || 'agenda-led start'}`;
    },
    shouldContinue: (contributions) => contributions.length < meeting.agentIds.length * 2,
  });
  const completed = await operations.updateMeeting(
    organizationId,
    {
      ...running,
      status: 'COMPLETED',
      contributions: result.contributions,
      minutes: {
        summary: result.distilledContext,
        decisions: meeting.agenda
          .slice(0, 3)
          .map((item) => ({ title: item, decision: 'Discussed and recorded.' })),
        actionItems: meeting.agentIds
          .slice(0, 3)
          .map((agentId) => ({ title: `Follow up on ${meeting.title}`, ownerAgentId: agentId })),
      },
      cost: Number((result.contributions.length * 0.01).toFixed(2)),
    },
    actorId,
  );
  await operations.addCost(
    {
      organizationId,
      amount: completed.cost,
      occurredAt: new Date().toISOString(),
      provider: 'internal',
      model: 'bounded-meeting',
      meetingId: meeting.id,
    },
    actorId,
  );
  return NextResponse.json({ meeting: completed });
}
