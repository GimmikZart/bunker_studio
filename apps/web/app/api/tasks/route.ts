import { taskCreateSchema, taskStateSchema, taskTransitionSchema } from '@bunker-studio/contracts';
import { canWrite, evaluateBudgetPolicies } from '@bunker-studio/core';
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
  if (!operations || !agents)
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
    if (state === 'QUEUED' || state === 'RUNNING') {
      const task = (await operations.listTasks(organizationId, actorId)).find(
        (candidate) => candidate.id === taskId,
      );
      if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      if (!task.assignedAgentId)
        return NextResponse.json(
          { error: 'Assign an agent before queueing this task.' },
          { status: 409 },
        );
      const assignedAgent = await agents.getAgent(task.assignedAgentId, organizationId, actorId);
      if (
        assignedAgent.providerConnectionId === 'unbound' ||
        assignedAgent.providerModelId === 'unconfigured' ||
        assignedAgent.runtimeType === 'UNCONFIGURED'
      )
        return NextResponse.json(
          { error: 'The assigned agent needs a provider, model, and runtime before queueing.' },
          { status: 409 },
        );
      if (assignedAgent.runtimeType === 'CODEX_SDK') {
        if (!task.writeScope.length)
          return NextResponse.json(
            { error: 'A Codex repository task requires at least one write scope.' },
            { status: 409 },
          );
        if (!task.verificationCommands?.length)
          return NextResponse.json(
            {
              error:
                'A Codex repository task requires at least one deterministic verification command.',
            },
            { status: 409 },
          );
        const repository = await operations.getRepository(task.projectId, organizationId, actorId);
        if (
          !repository ||
          repository.providerType !== 'GITHUB' ||
          repository.status !== 'CONNECTED'
        )
          return NextResponse.json(
            { error: 'Connect a writable GitHub repository before queueing a Codex task.' },
            { status: 409 },
          );
      }
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
    return NextResponse.json({
      task: await operations.transitionTask(taskId, organizationId, state, actorId),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    return NextResponse.json({ error: 'Invalid task transition.' }, { status: 409 });
  }
}
