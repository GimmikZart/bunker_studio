import { leadPlanSubmissionSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository, getWebTenancyRepository } from '../../_data';

function topologicalTaskKeys(tasks: { id: string; dependencies: string[] }[]): string[] | null {
  const ids = new Set(tasks.map((task) => task.id));
  if (ids.size !== tasks.length) return null;
  if (tasks.some((task) => task.dependencies.some((dependency) => !ids.has(dependency))))
    return null;
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const ordered: string[] = [];
  while (remaining.size) {
    const next = [...remaining.values()].find((task) =>
      task.dependencies.every((dependency) => !remaining.has(dependency)),
    );
    if (!next) return null;
    remaining.delete(next.id);
    ordered.push(next.id);
  }
  return ordered;
}

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
    const input = leadPlanSubmissionSchema.parse(await request.json());
    if (!(await operations.getRole(organizationId, actorUserId)))
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    const project = (await tenancy.listProjects(organizationId, actorUserId)).find(
      (candidate) => candidate.id === input.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const approvedDesignIds = new Set(
      (await operations.listDesignVersions(organizationId, actorUserId))
        .filter((design) => design.status === 'APPROVED')
        .map((design) => design.id),
    );
    if (
      input.plan.tasks.some(
        (task) =>
          task.taskType === 'FRONTEND' &&
          !approvedDesignIds.has(task.approvedDesignVersionId ?? ''),
      )
    )
      return NextResponse.json(
        { error: 'Every frontend task requires an approved design version.' },
        { status: 409 },
      );
    if (input.plan.tasks.some((task) => task.dependencies.includes(task.id)))
      return NextResponse.json({ error: 'A task cannot depend on itself.' }, { status: 400 });
    const order = topologicalTaskKeys(input.plan.tasks);
    if (!order)
      return NextResponse.json({ error: 'Lead plan contains an invalid DAG.' }, { status: 400 });
    const workflow = await operations.createWorkflow(
      {
        organizationId,
        projectId: input.projectId,
        plan: {
          goal: input.plan.goal,
          assumptions: input.plan.assumptions,
          verificationSteps: input.plan.verificationSteps,
        },
        createdByUserId: actorUserId,
      },
      actorUserId,
    );
    const idMap = new Map<string, string>();
    const tasksById = new Map(input.plan.tasks.map((task) => [task.id, task]));
    const createdTasks = [];
    for (const taskKey of order) {
      const planTask = tasksById.get(taskKey)!;
      const dependencies = planTask.dependencies.map((dependency) => idMap.get(dependency));
      if (dependencies.some((dependency) => !dependency))
        return NextResponse.json({ error: 'Lead plan dependency remap failed.' }, { status: 400 });
      const task = await operations.createTask(
        {
          organizationId,
          projectId: input.projectId,
          workflowId: workflow.id,
          title: planTask.title,
          description: `${planTask.description}\n\nDefinition of done:\n${planTask.definitionOfDone.map((item) => `- ${item}`).join('\n')}`,
          taskType: planTask.taskType,
          dependencies: dependencies as string[],
          readScope: planTask.readScope,
          writeScope: planTask.writeScope,
          ...(planTask.requiredCapability
            ? { requiredCapability: planTask.requiredCapability }
            : {}),
          ...(planTask.parallelGroupId ? { parallelGroupId: planTask.parallelGroupId } : {}),
          ...(planTask.approvedDesignVersionId
            ? { approvedDesignVersionId: planTask.approvedDesignVersionId }
            : {}),
          definitionOfDone: planTask.definitionOfDone,
          estimatedCost: planTask.estimatedCost,
          priority: 0,
        },
        actorUserId,
      );
      idMap.set(planTask.id, task.id);
      createdTasks.push(task);
    }
    const rootTaskId = createdTasks[0]?.id ?? null;
    const persistedWorkflow = await operations.updateWorkflowTasks(
      organizationId,
      workflow.id,
      createdTasks.map((task) => task.id),
      rootTaskId,
      actorUserId,
    );
    await operations.recordActivity({
      organizationId,
      eventType: 'WORKFLOW_PLAN_CREATED',
      aggregateType: 'workflow',
      aggregateId: workflow.id,
      payload: { actorUserId, taskCount: createdTasks.length },
    });
    return NextResponse.json({ workflow: persistedWorkflow, tasks: createdTasks }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid lead plan.' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const actorUserId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorUserId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    if (!(await operations.getRole(organizationId, actorUserId)))
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({
      workflows: await operations.listWorkflows(organizationId, actorUserId),
    });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}
