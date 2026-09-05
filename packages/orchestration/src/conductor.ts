import { scopesOverlap } from './scope.js';
import type { TaskState } from './index.js';

/**
 * What moves a project forward.
 *
 * Every transition the studio makes on its own is decided here, from the state
 * of the work and nothing else: no model is asked whether a task may start. The
 * function is pure and idempotent — running it twice over the same project
 * changes nothing the second time — so the same decision can be applied from a
 * page, from a worker finishing a task, or from a schedule, without any of them
 * disagreeing.
 */

export type ConductorTask = {
  id: string;
  title: string;
  state: TaskState;
  dependencies: string[];
  writeScope: string[];
  estimatedCost: number;
  assignedAgentId?: string;
};

/** How far the studio may go before the person who owns the project is needed. */
export type AutonomyMode = 'MANUAL' | 'SUPERVISED' | 'AUTONOMOUS' | 'LAB';

export type ConductorInput = {
  autonomyMode: AutonomyMode;
  tasks: ConductorTask[];
  /** Headroom under the tightest hard budget, or `null` when no hard cap applies. */
  remainingBudget: number | null;
  /** How many tasks the project may have in flight at once. */
  maxConcurrent?: number;
};

export type ConductorMove = {
  taskId: string;
  title: string;
  from: TaskState;
  to: TaskState;
  reason: string;
};

export type ConductorHold = {
  taskId: string;
  title: string;
  reason: string;
};

export type ConductorPlan = {
  moves: ConductorMove[];
  /** Work that is ready but deliberately not started yet, and why. */
  holds: ConductorHold[];
};

const DEFAULT_MAX_CONCURRENT = 2;
/** States in which a task is occupying a slot and holding its write scope. */
const IN_FLIGHT: TaskState[] = ['QUEUED', 'RUNNING'];

function titlesOf(ids: string[], byId: Map<string, ConductorTask>): string {
  const titles = ids.map((id) => byId.get(id)?.title ?? id);
  return titles.length > 1 ? `${titles.slice(0, -1).join(', ')} and ${titles.at(-1)}` : titles[0]!;
}

export function conductProject(input: ConductorInput): ConductorPlan {
  const maxConcurrent = input.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const byId = new Map(input.tasks.map((task) => [task.id, task]));
  const done = new Set(input.tasks.filter((task) => task.state === 'DONE').map((task) => task.id));
  const plan: ConductorPlan = { moves: [], holds: [] };

  // A task's state is where the work is, so a task that was parked for a reason
  // that no longer holds is released before anything else is considered.
  const state = new Map(input.tasks.map((task) => [task.id, task.state]));
  const move = (task: ConductorTask, to: TaskState, reason: string) => {
    plan.moves.push({ taskId: task.id, title: task.title, from: state.get(task.id)!, to, reason });
    state.set(task.id, to);
  };
  const blocking = (task: ConductorTask) =>
    task.dependencies.filter((dependency) => !done.has(dependency));

  for (const task of input.tasks) {
    const current = state.get(task.id)!;
    if (current === 'DRAFT') move(task, 'READY', 'The task exists and can be picked up.');
    else if (current === 'FIX_REQUIRED')
      move(task, 'READY', 'The review asked for changes, so the work goes back in the queue.');
    else if (current === 'WAITING_DEPENDENCY' && !blocking(task).length)
      move(task, 'READY', 'Everything it was waiting for is done.');
    else if (current === 'BLOCKED' && task.assignedAgentId)
      move(task, 'READY', 'It now has an agent who can do it.');
    else if (
      current === 'WAITING_BUDGET_APPROVAL' &&
      (input.remainingBudget === null || task.estimatedCost <= input.remainingBudget)
    )
      move(task, 'READY', 'The budget now covers it.');
  }

  // Slots and write scopes already taken. Two tasks writing the same paths at
  // once produce two branches that will fight each other at merge time, so they
  // are serialised even when a slot is free.
  const inFlight = input.tasks.filter((task) => IN_FLIGHT.includes(state.get(task.id)!));
  let capacity = maxConcurrent - inFlight.length;
  const heldScopes = inFlight.map((task) => task.writeScope);
  let budget = input.remainingBudget;

  for (const task of input.tasks) {
    if (state.get(task.id) !== 'READY') continue;

    const waitingFor = blocking(task);
    if (waitingFor.length) {
      move(task, 'WAITING_DEPENDENCY', `Waiting for ${titlesOf(waitingFor, byId)}.`);
      continue;
    }
    if (!task.assignedAgentId) {
      move(
        task,
        'BLOCKED',
        'No agent on this project can do it. Put someone on the project who fits the work.',
      );
      continue;
    }
    if (budget !== null && task.estimatedCost > budget) {
      move(
        task,
        'WAITING_BUDGET_APPROVAL',
        `The remaining budget of ${budget} does not cover its estimated ${task.estimatedCost}.`,
      );
      continue;
    }
    // Beyond this point the task could start. Whether it may is the project's
    // autonomy policy, which the specification already defines; the conductor
    // does not invent a second switch for it.
    if (input.autonomyMode === 'MANUAL' || input.autonomyMode === 'SUPERVISED') {
      plan.holds.push({
        taskId: task.id,
        title: task.title,
        reason: `This project runs in ${input.autonomyMode.toLowerCase()} mode, so it starts when you say so.`,
      });
      continue;
    }
    if (capacity <= 0) {
      plan.holds.push({
        taskId: task.id,
        title: task.title,
        reason: `Waiting for a free slot: ${maxConcurrent} tasks already in flight.`,
      });
      continue;
    }
    const conflicting = heldScopes.find((scope) => scopesOverlap(scope, task.writeScope));
    if (conflicting) {
      plan.holds.push({
        taskId: task.id,
        title: task.title,
        reason: `Another task is already writing ${conflicting.join(', ')}.`,
      });
      continue;
    }

    move(task, 'QUEUED', 'Its dependencies are done and an agent is free to take it.');
    capacity -= 1;
    heldScopes.push(task.writeScope);
    if (budget !== null) budget -= task.estimatedCost;
  }

  return plan;
}

/** True when a move is one the person who owns the project should hear about. */
export function movesWorthReporting(moves: ConductorMove[]): ConductorMove[] {
  return moves.filter((entry) => entry.to === 'BLOCKED' || entry.to === 'WAITING_BUDGET_APPROVAL');
}
