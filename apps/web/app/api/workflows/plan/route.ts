import { leadPlanSubmissionSchema } from '@bunker-studio/contracts';
import { remainingHardBudget } from '@bunker-studio/core';
import { validateLeadPlanProposal } from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../../_data';

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
    const approvedDesignVersionIds = (
      await operations.listDesignVersions(organizationId, actorUserId)
    )
      .filter((design) => design.status === 'APPROVED')
      .map((design) => design.id);
    const agents = await getWebAgentRepository();
    const teamCapabilities = agents
      ? [
          ...new Set(
            (await agents.listAgents(organizationId, actorUserId)).flatMap((agent) => agent.skills),
          ),
        ]
      : [];
    // The same gates the planner applies, enforced again here: this is the only
    // place a plan becomes real work, so it cannot be bypassed by posting a plan
    // that was never generated.
    const validated = validateLeadPlanProposal(input.plan, {
      approvedDesignVersionIds,
      remainingBudget: remainingHardBudget({
        policies: await operations.listBudgetPolicies(organizationId, actorUserId),
        entries: await operations.listCosts(organizationId, actorUserId),
        context: { projectId: input.projectId },
      }),
      teamCapabilities,
    });
    if (!validated.ok)
      return NextResponse.json(
        { error: 'The plan violates the studio rules.', reasons: validated.reasons },
        { status: 400 },
      );
    const order = validated.order;
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
          verificationCommands: planTask.verificationCommands,
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
