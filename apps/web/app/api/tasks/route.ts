import { taskCreateSchema, taskStateSchema, taskTransitionSchema } from '@bunker-studio/contracts';
import { canWrite, evaluateBudgetPolicies } from '@bunker-studio/core';
import { taskReviewGate, type TaskState } from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { queueReadiness } from '../_queue-gate';
import { advanceProject } from '../_conductor';
import { resolveActorId } from '../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../_data';

function workerVerificationStatuses(task: {
  workerResult?: Record<string, unknown>;
}): string[] | undefined {
  const verification = task.workerResult?.verification;
  if (!Array.isArray(verification)) return undefined;
  return verification.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const status = (entry as Record<string, unknown>).status;
    return typeof status === 'string' ? [status] : [];
  });
}

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({ tasks: await operations.listTasks(organizationId, actorId) });
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
  try {
    const input = taskCreateSchema.parse(await request.json());
    const project = (await tenancy.listProjects(organizationId, actorId)).find(
      (item) => item.id === input.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    if (input.assignedAgentId)
      await agents.getAgent(input.assignedAgentId, organizationId, actorId);
    if (input.taskType === 'FRONTEND' && !input.approvedDesignVersionId)
      return NextResponse.json(
        { error: 'Every frontend task requires an approved design version.' },
        { status: 409 },
      );
    if (input.approvedDesignVersionId) {
      const design = (await operations.listDesignVersions(organizationId, actorId)).find(
        (version) => version.id === input.approvedDesignVersionId && version.status === 'APPROVED',
      );
      if (!design)
        return NextResponse.json(
          { error: 'An approved design version is required for this task.' },
          { status: 409 },
        );
    }
    const tasks = await operations.listTasks(organizationId, actorId);
    if (input.dependencies.some((dependency) => !tasks.some((task) => task.id === dependency)))
      return NextResponse.json({ error: 'Task dependency not found.' }, { status: 400 });
    return NextResponse.json(
      { task: await operations.createTask({ organizationId, ...input }, actorId) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid task payload.' }, { status: 400 });
  }
}

/** Ending a task is what can let the next one start. */
const RELEASING_STATES: TaskState[] = ['DONE', 'CANCELED', 'FAILED_FINAL'];

export async function PATCH(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!actorId || !organizationId || !taskId)
    return NextResponse.json(
      { error: 'Authentication, organization and task are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const agents = await getWebAgentRepository();
  const tenancy = await getWebTenancyRepository();
  if (!operations || !agents || !tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!canWrite(role))
    return NextResponse.json(
      { error: 'Owner or admin task transition is required.' },
      { status: 403 },
    );
  try {
    const input = taskTransitionSchema.parse(await request.json());
    const state = taskStateSchema.parse(input.state);
    const task = (await operations.listTasks(organizationId, actorId)).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    if (state === 'QUEUED' || state === 'RUNNING') {
      // The same conditions the conductor applies when it queues work on its
      // own, so neither path can start something the other would refuse.
      const assignedAgent = task.assignedAgentId
        ? await agents.getAgent(task.assignedAgentId, organizationId, actorId)
        : null;
      const readiness = queueReadiness({
        task,
        agent: assignedAgent,
        repository:
          assignedAgent?.runtimeType === 'CODEX_SDK'
            ? await operations.getRepository(task.projectId, organizationId, actorId)
            : null,
      });
      if (!readiness.ok) return NextResponse.json({ error: readiness.reason }, { status: 409 });
      const budget = evaluateBudgetPolicies({
        policies: await operations.listBudgetPolicies(organizationId, actorId),
        entries: await operations.listCosts(organizationId, actorId),
        estimatedCost: task.estimatedCost,
        context: { projectId: task.projectId, taskId: task.id },
      });
      if (budget.decision !== 'ALLOW') {
        const nextState = budget.decision === 'HARD_STOP' ? 'BLOCKED' : 'WAITING_BUDGET_APPROVAL';
        const gatedTask = await operations.transitionTask(
          taskId,
          organizationId,
          nextState,
          actorId,
        );
        await Promise.resolve(
          operations.addNotification(
            {
              organizationId,
              userId: actorId,
              category: 'BUDGET',
              severity: budget.decision === 'HARD_STOP' ? 'CRITICAL' : 'HIGH',
              title:
                budget.decision === 'HARD_STOP'
                  ? 'Task blocked by hard budget'
                  : 'Budget approval required',
              body: `Task "${task.title}" cannot start until the budget policy is resolved.`,
              deepLink: `/tasks?taskId=${task.id}`,
            },
            actorId,
          ),
        ).catch(() => undefined);
        return NextResponse.json(
          { error: 'Budget policy prevents starting this task.', task: gatedTask, budget },
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
              title: 'Budget soft threshold reached',
              body: `Task "${task.title}" will start above a configured soft budget threshold.`,
              deepLink: `/tasks?taskId=${task.id}`,
            },
            actorId,
          ),
        ).catch(() => undefined);
      }
    }
    if (state === 'REVIEW_PENDING' || state === 'DONE' || state === 'FIX_REQUIRED') {
      const [verificationRuns, reviews] = await Promise.all([
        operations.listVerificationRuns(organizationId, actorId, taskId),
        state === 'REVIEW_PENDING'
          ? Promise.resolve([])
          : operations.listReviews(organizationId, actorId, taskId),
      ]);
      const gate = taskReviewGate({
        target: state,
        workerVerificationStatuses: workerVerificationStatuses(task),
        verificationStatuses: verificationRuns.map((verification) => verification.status),
        ...(task.candidateCommitSha ? { candidateSha: task.candidateCommitSha } : {}),
        ...(task.candidateCiStatus ? { ciStatus: task.candidateCiStatus } : {}),
        reviews: reviews.map((review) => ({
          candidateSha: review.candidateSha,
          status: review.status,
        })),
      });
      if (!gate.allowed)
        return NextResponse.json(
          {
            error: 'Task verification, exact-candidate CI, or reviewer evidence is incomplete.',
            gate,
          },
          { status: 409 },
        );
    }
    const updated = await operations.transitionTask(taskId, organizationId, state, actorId);
    // Only the end of a task can release what waited on it. Reconsidering the
    // project after every transition would also mean overriding a state a person
    // had just set by hand, which is not the studio's business.
    const project = RELEASING_STATES.includes(state)
      ? (await tenancy.listProjects(organizationId, actorId)).find(
          (candidate) => candidate.id === task.projectId,
        )
      : undefined;
    const advanced = project
      ? await advanceProject({ project, organizationId, actorId, operations, agents }).catch(
          () => null,
        )
      : null;
    return NextResponse.json({ task: updated, ...(advanced ? { advanced } : {}) });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    return NextResponse.json({ error: 'Invalid task transition.' }, { status: 409 });
  }
}
