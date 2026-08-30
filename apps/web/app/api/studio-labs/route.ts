import { protectedProjectPolicy } from '@bunker-studio/core';
import { studioLabRequestSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../_data';

type Proposal = { id: string; title: string; rationale: string; writeScope: string[] };

function proposals(snapshot: {
  completedTasks: number;
  reviewPassRate: number;
  activityEvents: number;
}): Proposal[] {
  const result: Proposal[] = [];
  if (!snapshot.completedTasks)
    result.push({
      id: 'establish-delivery-loop',
      title: 'Establish a verified delivery loop',
      rationale:
        'No completed task is visible yet; add a bounded task, verification and review path.',
      writeScope: ['apps/web', 'packages'],
    });
  if (snapshot.reviewPassRate < 1)
    result.push({
      id: 'tighten-review-feedback',
      title: 'Tighten the review feedback loop',
      rationale:
        'Review data shows findings or missing first-pass evidence; improve deterministic gates.',
      writeScope: ['packages/core', 'packages/orchestration'],
    });
  if (!snapshot.activityEvents)
    result.push({
      id: 'instrument-domain-events',
      title: 'Instrument domain events',
      rationale:
        'The activity stream is empty; make meaningful control-plane transitions observable.',
      writeScope: ['apps/web/app/api'],
    });
  return result.length
    ? result
    : [
        {
          id: 'reduce-operational-cost',
          title: 'Reduce operational cost',
          rationale:
            'The current loop is healthy; inspect cost and latency before expanding autonomy.',
          writeScope: ['packages/core', 'apps/worker'],
        },
      ];
}

async function dependencies(request: Request) {
  const actorUserId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorUserId || !organizationId) return null;
  const tenancy = await getWebTenancyRepository();
  const operations = await getWebOperationalRepository();
  const agents = await getWebAgentRepository();
  if (!tenancy || !operations || !agents) return null;
  return { actorUserId, organizationId, tenancy, operations, agents };
}

export async function POST(request: Request) {
  const context = await dependencies(request);
  if (!context)
    return NextResponse.json(
      { error: 'Authentication, organization and persistence are required.' },
      { status: 401 },
    );
  const { actorUserId, organizationId, tenancy, operations, agents } = context;
  try {
    const input = studioLabRequestSchema.parse(await request.json());
    const role = await operations.getRole(organizationId, actorUserId);
    if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    if (input.action === 'INITIALIZE') {
      if (role !== 'OWNER')
        return NextResponse.json(
          { error: 'Only the Owner can initialize Studio Core.' },
          { status: 403 },
        );
      const existing = (await tenancy.listProjects(organizationId, actorUserId)).find(
        (project) => project.isStudioCore,
      );
      if (existing) return NextResponse.json({ project: existing, created: false });
      const project = await tenancy.createProject({
        organizationId,
        actorUserId,
        name: 'Bunker Studio Core',
        description: 'Protected project for reviewed Studio Labs improvements.',
        isStudioCore: true,
      });
      await operations.recordActivity({
        organizationId,
        eventType: 'STUDIO_CORE_INITIALIZED',
        aggregateType: 'project',
        aggregateId: project.id,
        payload: { actorUserId },
      });
      return NextResponse.json({ project, created: true }, { status: 201 });
    }
    const [tasks, costs, reviews, activity] = await Promise.all([
      operations.listTasks(organizationId, actorUserId),
      operations.listCosts(organizationId, actorUserId),
      operations.listReviews(organizationId, actorUserId),
      operations.listActivity(organizationId, actorUserId),
    ]);
    const snapshot = {
      completedTasks: tasks.filter((task) => task.state === 'DONE').length,
      reviewPassRate: reviews.length
        ? reviews.filter((review) => review.status === 'PASS').length / reviews.length
        : 0,
      totalCost: costs.reduce((total, cost) => total + cost.amount, 0),
      activityEvents: activity.length,
      agentCount: (await agents.listAgents(organizationId, actorUserId)).length,
    };
    if (input.action === 'ANALYZE')
      return NextResponse.json({ snapshot, proposals: proposals(snapshot) });
    const project = (await tenancy.listProjects(organizationId, actorUserId)).find(
      (candidate) => candidate.id === input.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    if (!project.isStudioCore)
      return NextResponse.json(
        { error: 'Studio Labs requires the protected Studio Core project.' },
        { status: 403 },
      );
    const proposal = proposals(snapshot).find((candidate) => candidate.id === input.proposalId);
    if (!proposal)
      return NextResponse.json({ error: 'Proposal is no longer available.' }, { status: 409 });
    const policy = protectedProjectPolicy({ isStudioCore: true, requestedAction: 'MERGE' });
    const task = await operations.createTask(
      {
        organizationId,
        projectId: project.id,
        title: proposal.title,
        description: proposal.rationale,
        taskType: 'REVIEW',
        dependencies: [],
        writeScope: proposal.writeScope,
        estimatedCost: 0,
        priority: 100,
      },
      actorUserId,
    );
    const approval = await operations.createApproval(
      {
        organizationId,
        approvalType: 'STUDIO_CORE_MERGE',
        subjectType: 'STUDIO_IMPROVEMENT',
        subjectId: task.id,
        title: proposal.title,
        risk: 'CRITICAL',
        requestedByUserId: actorUserId,
      },
      actorUserId,
    );
    await operations.recordActivity({
      organizationId,
      eventType: 'STUDIO_IMPROVEMENT_SELECTED',
      aggregateType: 'task',
      aggregateId: task.id,
      payload: { actorUserId, approvalId: approval.id, proposalId: proposal.id },
    });
    return NextResponse.json({ task, approval, policy }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid Studio Labs request.' }, { status: 400 });
  }
}
