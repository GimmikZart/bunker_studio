import { reviewSubmissionSchema } from '@bunker-studio/contracts';
import { canWrite, reviewOutcome } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../_data';

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const taskId = new URL(request.url).searchParams.get('taskId') ?? undefined;
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({
      reviews: await operations.listReviews(organizationId, actorId, taskId),
    });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const tenancy = await getWebTenancyRepository();
  const agents = await getWebAgentRepository();
  if (!operations || !tenancy || !agents)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!canWrite(role))
    return NextResponse.json(
      { error: 'Owner or admin review submission is required.' },
      { status: 403 },
    );
  try {
    const input = reviewSubmissionSchema.parse(await request.json());
    const project = (await tenancy.listProjects(organizationId, actorId)).find(
      (candidate) => candidate.id === input.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const task = input.taskId
      ? (await operations.listTasks(organizationId, actorId)).find(
          (candidate) => candidate.id === input.taskId,
        )
      : undefined;
    if (input.taskId && (!task || task.projectId !== input.projectId))
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    const reviewer = await agents.getAgent(input.reviewerAgentId, organizationId, actorId);
    if (reviewer.roleKey !== 'reviewer')
      return NextResponse.json({ error: 'A reviewer agent is required.' }, { status: 400 });
    const status = reviewOutcome(input.report.findings);
    if (input.report.status !== status)
      return NextResponse.json(
        {
          error: 'Review status does not match deterministic finding policy.',
          expectedStatus: status,
        },
        { status: 409 },
      );
    const verificationRuns = input.taskId
      ? await Promise.all(
          input.report.verificationRuns.map((run) =>
            operations.addVerificationRun(
              { ...run, organizationId, taskId: input.taskId! },
              actorId,
            ),
          ),
        )
      : [];
    const review = await operations.addReview(
      {
        organizationId,
        projectId: input.projectId,
        taskId: input.taskId,
        reviewerAgentId: input.reviewerAgentId,
        candidateSha: input.report.candidateSha,
        status,
        summary: input.report.summary,
        findings: input.report.findings,
      },
      actorId,
    );
    const fixTasks =
      status === 'FIX_REQUIRED'
        ? await Promise.all(
            input.report.findings
              .filter((finding) => finding.blocking)
              .map((finding) =>
                operations.createTask(
                  {
                    organizationId,
                    projectId: input.projectId,
                    title: `Fix review finding: ${finding.title}`,
                    description: finding.recommendation,
                    taskType: 'REVIEW',
                    dependencies: input.taskId ? [input.taskId] : [],
                    writeScope: finding.filePath ? [finding.filePath] : [],
                    estimatedCost: 0,
                    priority: 100,
                  },
                  actorId,
                ),
              ),
          )
        : [];
    return NextResponse.json({ review, verificationRuns, fixTasks }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid review payload.' }, { status: 400 });
  }
}
