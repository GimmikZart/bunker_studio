/**
 * Who does a task.
 *
 * A plan produced by the Lead names task types and capabilities, never people:
 * a model must not be able to hand a repository write to whichever agent it
 * likes. So the choice is made here, deterministically, from the agents the
 * project actually has — and when nobody fits, the task says so instead of
 * being given to someone at random.
 */

export type AssignableTaskType = 'FRONTEND' | 'BACKEND' | 'DESIGN' | 'TEST' | 'DOCS' | 'REVIEW';

export type AssignableAgent = {
  id: string;
  roleKey: string;
  skills: string[];
  /** Tasks the agent already holds. Used only to break ties. */
  activeTaskCount: number;
};

export type AssignableTask = {
  taskType: AssignableTaskType;
  requiredCapability?: string;
};

/**
 * The role that owns each kind of work.
 *
 * REVIEW and DESIGN are exclusive: a review written by the agent that wrote the
 * code is not a review, and only a designer's output may be cited by a frontend
 * task. The rest name a preferred role but accept any agent that carries the
 * skill, because a studio rarely has one specialist per task type.
 */
const PREFERRED_ROLE: Record<AssignableTaskType, string> = {
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  DESIGN: 'designer',
  REVIEW: 'reviewer',
  TEST: 'backend',
  DOCS: 'lead',
};
const EXCLUSIVE_TASK_TYPES = new Set<AssignableTaskType>(['REVIEW', 'DESIGN']);

export type AssignmentOutcome = { ok: true; agentId: string } | { ok: false; reason: string };

/**
 * Picks the agent for one task: the required capability first, then the role
 * that owns the work, then the lightest load, then a stable order by id so the
 * same inputs always produce the same answer.
 */
export function selectAgentForTask(
  task: AssignableTask,
  agents: AssignableAgent[],
): AssignmentOutcome {
  const role = PREFERRED_ROLE[task.taskType];
  const capable = task.requiredCapability
    ? agents.filter((agent) => agent.skills.includes(task.requiredCapability!))
    : agents;
  if (!capable.length)
    return {
      ok: false,
      reason: task.requiredCapability
        ? `No agent on this project declares the capability "${task.requiredCapability}".`
        : 'This project has no agent assigned to it.',
    };

  const matchingRole = capable.filter((agent) => agent.roleKey === role);
  if (EXCLUSIVE_TASK_TYPES.has(task.taskType) && !matchingRole.length)
    return {
      ok: false,
      reason: `A ${task.taskType} task can only be done by an agent whose role is "${role}", and this project has none.`,
    };

  const candidates = matchingRole.length ? matchingRole : capable;
  const chosen = [...candidates].sort(
    (a, b) => a.activeTaskCount - b.activeTaskCount || a.id.localeCompare(b.id),
  )[0]!;
  return { ok: true, agentId: chosen.id };
}

export type TaskAssignmentPlan<T extends AssignableTask> = {
  assigned: { task: T; agentId: string }[];
  unassigned: { task: T; reason: string }[];
};

/**
 * Assigns a whole plan in one pass, counting each choice against the agent's
 * load so a six-task plan spreads across the team instead of landing entirely
 * on the first name that matched.
 */
export function assignTasks<T extends AssignableTask>(
  tasks: T[],
  agents: AssignableAgent[],
): TaskAssignmentPlan<T> {
  const load = new Map(agents.map((agent) => [agent.id, agent.activeTaskCount]));
  const plan: TaskAssignmentPlan<T> = { assigned: [], unassigned: [] };
  for (const task of tasks) {
    const outcome = selectAgentForTask(
      task,
      agents.map((agent) => ({ ...agent, activeTaskCount: load.get(agent.id) ?? 0 })),
    );
    if (!outcome.ok) {
      plan.unassigned.push({ task, reason: outcome.reason });
      continue;
    }
    load.set(outcome.agentId, (load.get(outcome.agentId) ?? 0) + 1);
    plan.assigned.push({ task, agentId: outcome.agentId });
  }
  return plan;
}
