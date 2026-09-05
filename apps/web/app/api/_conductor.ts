import { remainingHardBudget } from '@bunker-studio/core';
import {
  assignTasks,
  conductProject,
  movesWorthReporting,
  type AutonomyMode,
  type ConductorHold,
  type ConductorMove,
  type TaskState,
} from '@bunker-studio/orchestration';
import { queueReadiness } from './_queue-gate';
import type { WebAgentRepository, WebOperationalRepository } from './_data';

/** States in which a task is finished with, one way or another. */
const CLOSED: TaskState[] = ['DONE', 'CANCELED', 'FAILED_FINAL'];

export type AdvanceResult = {
  moves: ConductorMove[];
  holds: ConductorHold[];
  /** Tasks that still have nobody who could do them, and why. */
  unassigned: { taskId: string; title: string; reason: string }[];
};

/**
 * One pass of the studio moving a project forward.
 *
 * It is deliberately callable from several places — a plan being committed, an
 * agent joining a project, a task finishing, a person pressing "advance" — and
 * is safe to call from all of them, because the decision itself is pure and
 * idempotent. Calling it twice does nothing the second time.
 */
export async function advanceProject(input: {
  project: { id: string; autonomyMode: string };
  organizationId: string;
  actorId: string;
  operations: WebOperationalRepository;
  agents: WebAgentRepository;
}): Promise<AdvanceResult> {
  const { project, organizationId, actorId, operations, agents } = input;
  const allTasks = await operations.listTasks(organizationId, actorId);
  const tasks = allTasks.filter((task) => task.projectId === project.id);
  if (!tasks.length) return { moves: [], holds: [], unassigned: [] };

  const [roster, assignments] = await Promise.all([
    agents.listAgents(organizationId, actorId),
    agents.listAssignments(organizationId, actorId),
  ]);
  const staffed = new Set(
    assignments
      .filter((assignment) => assignment.projectId === project.id)
      .map((assignment) => assignment.agentId),
  );
  const team = roster.filter((agent) => staffed.has(agent.id) && !agent.archivedAt);

  // Work that was blocked for want of an agent becomes doable the moment
  // somebody who fits joins the project, so the router runs again over whatever
  // is still unowned rather than only at planning time.
  const open = tasks.filter((task) => !CLOSED.includes(task.state as TaskState));
  const orphans = open.filter((task) => !task.assignedAgentId);
  const unassigned: AdvanceResult['unassigned'] = [];
  const assignedNow = new Map<string, string>();
  if (orphans.length && team.length) {
    const plan = assignTasks(
      orphans.map((task) => ({
        key: task.id,
        title: task.title,
        taskType: task.taskType,
        ...(task.requiredCapability ? { requiredCapability: task.requiredCapability } : {}),
      })),
      team.map((agent) => ({
        id: agent.id,
        roleKey: agent.roleKey,
        skills: agent.skills,
        activeTaskCount: open.filter((task) => task.assignedAgentId === agent.id).length,
      })),
    );
    for (const entry of plan.assigned) {
      await operations.assignTaskAgent(entry.task.key, organizationId, entry.agentId, actorId);
      assignedNow.set(entry.task.key, entry.agentId);
    }
    for (const entry of plan.unassigned)
      unassigned.push({
        taskId: entry.task.key,
        title: entry.task.title,
        reason: entry.reason,
      });
  } else if (orphans.length)
    for (const task of orphans)
      unassigned.push({
        taskId: task.id,
        title: task.title,
        reason: 'This project has no agent assigned to it.',
      });

  const [policies, costs] = await Promise.all([
    operations.listBudgetPolicies(organizationId, actorId),
    operations.listCosts(organizationId, actorId),
  ]);
  // A task whose agent or repository is not ready must not be queued by the
  // conductor either. It is presented to the decision as unassigned, which is
  // the state that produces BLOCKED with a reason.
  const repository = await Promise.resolve(
    operations.getRepository(project.id, organizationId, actorId),
  ).catch(() => null);
  const byAgent = new Map(roster.map((agent) => [agent.id, agent]));
  // Why a task cannot start, most specific first. The router knows which role
  // is missing from the project — "no reviewer here" — and that is far more
  // useful than the gate's "assign an agent", which is merely its symptom.
  const blockedReason = new Map(unassigned.map((entry) => [entry.taskId, entry.reason]));
  const startable = (task: (typeof tasks)[number]): boolean => {
    const agentId = task.assignedAgentId ?? assignedNow.get(task.id);
    const agent = agentId ? byAgent.get(agentId) : undefined;
    const readiness = queueReadiness({
      task: { ...task, ...(agentId ? { assignedAgentId: agentId } : {}) },
      agent: agent ?? null,
      repository: repository ?? null,
    });
    if (readiness.ok) return true;
    if (agentId || !blockedReason.has(task.id)) blockedReason.set(task.id, readiness.reason);
    return false;
  };
  const plan = conductProject({
    autonomyMode: (project.autonomyMode as AutonomyMode) ?? 'AUTONOMOUS',
    remainingBudget: remainingHardBudget({
      policies,
      entries: costs,
      context: { projectId: project.id },
    }),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      state: task.state as TaskState,
      dependencies: task.dependencies,
      writeScope: task.writeScope,
      estimatedCost: task.estimatedCost ?? 0,
      ...(startable(task)
        ? { assignedAgentId: task.assignedAgentId ?? assignedNow.get(task.id)! }
        : {}),
    })),
  });

  const applied: ConductorMove[] = [];
  for (const raw of plan.moves) {
    // The conductor only knows "nobody can do this"; the gate knows why, and the
    // difference between "put a reviewer on the project" and "connect a
    // repository" is the whole value of the message.
    const move =
      raw.to === 'BLOCKED' && blockedReason.has(raw.taskId)
        ? { ...raw, reason: blockedReason.get(raw.taskId)! }
        : raw;
    // A transition refused here is not a reason to abandon the rest: another
    // process may have moved that one task on already.
    try {
      await operations.transitionTask(move.taskId, organizationId, move.to, actorId);
      applied.push(move);
    } catch {
      continue;
    }
  }

  if (applied.length)
    await operations
      .recordActivity({
        organizationId,
        eventType: 'PROJECT_ADVANCED',
        aggregateType: 'project',
        aggregateId: project.id,
        payload: {
          actorUserId: actorId,
          moves: applied.map((move) => ({ taskId: move.taskId, from: move.from, to: move.to })),
        },
      })
      .catch(() => undefined);

  // Only what needs a person is worth an interruption: work that started on its
  // own is what the studio is for, and saying so every time would train people
  // to ignore the inbox.
  for (const move of movesWorthReporting(applied))
    await Promise.resolve(
      operations.addNotification(
        {
          organizationId,
          userId: actorId,
          category: 'WORKFLOW',
          severity: move.to === 'WAITING_BUDGET_APPROVAL' ? 'HIGH' : 'LOW',
          title:
            move.to === 'WAITING_BUDGET_APPROVAL'
              ? `"${move.title}" is waiting on budget`
              : `"${move.title}" cannot start`,
          body: move.reason,
          deepLink: `/projects`,
        },
        actorId,
      ),
    ).catch(() => undefined);

  return { moves: applied, holds: plan.holds, unassigned };
}
