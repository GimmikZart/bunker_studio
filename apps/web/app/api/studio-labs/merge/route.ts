import { protectedMergeGate } from '@bunker-studio/core';
import { studioLabMergeSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository, getWebTenancyRepository } from '../../_data';

export async function POST(request: Request) {
  const actorUserId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorUserId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const tenancy = await getWebTenancyRepository();
  if (!operations || !tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const { taskId } = studioLabMergeSchema.parse(await request.json());
    const role = await operations.getRole(organizationId, actorUserId);
    if (role !== 'OWNER')
      return NextResponse.json(
        { error: 'Only the Owner can authorize a protected merge.' },
        { status: 403 },
      );
    const task = (await operations.listTasks(organizationId, actorUserId)).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    const project = (await tenancy.listProjects(organizationId, actorUserId)).find(
      (candidate) => candidate.id === task.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const [reviews, verificationRuns, approvals] = await Promise.all([
      operations.listReviews(organizationId, actorUserId, taskId),
      operations.listVerificationRuns(organizationId, actorUserId, taskId),
      operations.listApprovals(organizationId, actorUserId),
    ]);
    const gate = protectedMergeGate({
      isStudioCore: project.isStudioCore,
      reviewerPassed: reviews.some((review) => review.status === 'PASS'),
      ciPassed:
        verificationRuns.length > 0 && verificationRuns.every((run) => run.status === 'PASS'),
      ownerApproved: approvals.some(
        (approval) =>
          approval.subjectId === taskId &&
          approval.approvalType === 'STUDIO_CORE_MERGE' &&
          approval.status === 'APPROVED',
      ),
      actorIsAgent: false,
    });
    if (!gate.allowed)
      return NextResponse.json(
        { error: 'Protected merge gates are incomplete.', gate },
        { status: 409 },
      );
    await operations.recordActivity({
      organizationId,
      eventType: 'STUDIO_PROTECTED_MERGE_READY',
      aggregateType: 'task',
      aggregateId: taskId,
      payload: { actorUserId },
    });
    return NextResponse.json({ taskId, gate, productionDeploy: false });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid protected merge request.' }, { status: 400 });
  }
}
