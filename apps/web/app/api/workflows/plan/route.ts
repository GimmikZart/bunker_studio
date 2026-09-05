import { leadPlanSubmissionSchema } from '@bunker-studio/contracts';
import { remainingHardBudget } from '@bunker-studio/core';
import { assignTasks, validateLeadPlanProposal } from '@bunker-studio/orchestration';
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
    // The team of this project, not of the whole organization. Offering the
    // Lead capabilities that belong to agents nobody put on this project
    // produced plans requiring people who were never going to show up.
    const projectAgents = agents
      ? await (async () => {
          const [roster, assignments] = await Promise.all([
            agents.listAgents(organizationId, actorUserId),
            agents.listAssignments(organizationId, actorUserId),
          ]);
          const staffed = new Set(
            assignments
              .filter((assignment) => assignment.projectId === input.projectId)
              .map((assignment) => assignment.agentId),
          );
          return roster.filter((agent) => staffed.has(agent.id) && !agent.archivedAt);
        })()
      : [];
    const teamCapabilities = [...new Set(projectAgents.flatMap((agent) => agent.skills))];
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
    // Who does what is decided here, deterministically, from the agents this
    // project has. The worker cannot claim a task without an assigned agent, so
    // a plan whose tasks nobody can take would otherwise become a queue that
    // never moves and never says why.
    const openTasks = (await operations.listTasks(organizationId, actorUserId)).filter(
      (task) => !['DONE', 'CANCELED', 'FAILED_FINAL'].includes(task.state),
    );
    const assignment = assignTasks(
      input.plan.tasks.map((task) => ({
        key: task.id,
        taskType: task.taskType,
        ...(task.requiredCapability ? { requiredCapability: task.requiredCapability } : {}),
      })),
      projectAgents.map((agent) => ({
        id: agent.id,
        roleKey: agent.roleKey,
        skills: agent.skills,
        activeTaskCount: openTasks.filter((task) => task.assignedAgentId === agent.id).length,
      })),
    );
    const agentByTaskKey = new Map(
      assignment.assigned.map((entry) => [entry.task.key, entry.agentId]),
    );
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
          ...(agentByTaskKey.has(planTask.id)
            ? { assignedAgentId: agentByTaskKey.get(planTask.id)! }
            : {}),
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
    return NextResponse.json(
      {
        workflow: persistedWorkflow,
        tasks: createdTasks,
        // Named rather than hidden: a task with nobody on it will sit in the
        // queue forever, and the reason is something the user can act on.
        unassigned: assignment.unassigned.map((entry) => ({
          title: tasksById.get(entry.task.key)?.title ?? entry.task.key,
          reason: entry.reason,
        })),
      },
      { status: 201 },
    );
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
