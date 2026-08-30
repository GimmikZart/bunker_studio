import { calculateAgentMetrics } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../../../_data';

export async function GET(request: Request, context: { params: Promise<{ agentId: string }> }) {
  const actorUserId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { agentId } = await context.params;
  if (!actorUserId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const agents = await getWebAgentRepository();
  const operations = await getWebOperationalRepository();
  const tenancy = await getWebTenancyRepository();
  if (!agents || !operations || !tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const agent = (await agents.listAgents(organizationId, actorUserId)).find(
      (item) => item.id === agentId,
    );
    if (!agent) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    const [assignments, projects, tasks, costs, reviews] = await Promise.all([
      agents.listAgentAssignments(agentId, organizationId, actorUserId),
      tenancy.listProjects(organizationId, actorUserId),
      operations.listTasks(organizationId, actorUserId),
      operations.listCosts(organizationId, actorUserId),
      operations.listReviews(organizationId, actorUserId),
    ]);
    const teamIds = new Set(
      assignments
        .map((assignment) => assignment.teamId)
        .filter((teamId): teamId is string => Boolean(teamId)),
    );
    const projectIds = new Set(
      projects
        .filter(
          (project) =>
            assignments.some((assignment) => assignment.projectId === project.id) ||
            project.teamIds.some((teamId) => teamIds.has(teamId)),
        )
        .map((project) => project.id),
    );
    const completedTasks = tasks.filter(
      (task) => projectIds.has(task.projectId) && task.state === 'DONE',
    );
    const reviewedTasks = reviews.filter((review) => review.reviewerAgentId === agentId);
    const totalCost = costs
      .filter((cost) => cost.agentId === agentId)
      .reduce((total, cost) => total + cost.amount, 0);
    const metrics = calculateAgentMetrics({
      completedTasks: completedTasks.length,
      reviewedTasks: reviewedTasks.length,
      passedReviews: reviewedTasks.filter((review) => review.status === 'PASS').length,
      totalCost,
      cycleTimesMs: [],
    });
    return NextResponse.json({
      agentId,
      assignmentCount: assignments.length,
      scopedProjectCount: projectIds.size,
      metrics,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Agent metrics unavailable.' }, { status: 500 });
  }
}
