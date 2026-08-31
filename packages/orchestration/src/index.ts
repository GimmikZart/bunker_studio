import {
  type AgentRuntime,
  collectRun,
  resumeRun,
  RuntimeError,
  type RunRequest,
  type RunResult,
} from '@bunker-studio/agent-runtime';
export * from './queue.js';
export * from './workflow.js';
export * from './meeting.js';
export * from './review-loop.js';

export const PACKAGE_NAME = '@bunker-studio/orchestration';

export type TaskState =
  | 'DRAFT'
  | 'READY'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_DEPENDENCY'
  | 'WAITING_APPROVAL'
  | 'WAITING_PROVIDER_QUOTA'
  | 'WAITING_BUDGET_APPROVAL'
  | 'BLOCKED'
  | 'IMPLEMENTED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL'
  | 'CANCELED'
  | 'VERIFYING'
  | 'REVIEW_PENDING'
  | 'FIX_REQUIRED'
  | 'DONE';
export type TaskDefinition = {
  id: string;
  state: TaskState;
  dependencies: string[];
  writeScope: string[];
  estimatedCost: number;
  parallelGroupId?: string;
};

const transitions: Record<TaskState, TaskState[]> = {
  DRAFT: ['READY', 'CANCELED'],
  READY: ['QUEUED', 'WAITING_DEPENDENCY', 'WAITING_BUDGET_APPROVAL', 'BLOCKED', 'CANCELED'],
  QUEUED: ['RUNNING', 'CANCELED'],
  RUNNING: [
    'QUEUED',
    'WAITING_APPROVAL',
    'WAITING_PROVIDER_QUOTA',
    'WAITING_BUDGET_APPROVAL',
    'BLOCKED',
    'IMPLEMENTED',
    'FAILED_RETRYABLE',
    'FAILED_FINAL',
    'CANCELED',
  ],
  WAITING_DEPENDENCY: ['READY', 'CANCELED'],
  WAITING_APPROVAL: ['READY', 'CANCELED'],
  WAITING_PROVIDER_QUOTA: ['READY', 'FAILED_FINAL', 'CANCELED'],
  WAITING_BUDGET_APPROVAL: ['READY', 'CANCELED'],
  BLOCKED: ['READY', 'CANCELED'],
  IMPLEMENTED: ['VERIFYING'],
  VERIFYING: ['REVIEW_PENDING', 'DONE', 'FIX_REQUIRED'],
  REVIEW_PENDING: ['DONE', 'FIX_REQUIRED'],
  FIX_REQUIRED: ['READY', 'CANCELED'],
  FAILED_RETRYABLE: ['QUEUED', 'FAILED_FINAL', 'CANCELED'],
  FAILED_FINAL: [],
  CANCELED: [],
  DONE: [],
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return transitions[from].includes(to);
}

export function transitionTask(task: TaskDefinition, to: TaskState): TaskDefinition {
  if (!canTransition(task.state, to))
    throw new Error(`Invalid task transition: ${task.state} -> ${to}`);
  return { ...task, state: to };
}

export function eligibleTasks(tasks: TaskDefinition[], remainingBudget: number): TaskDefinition[] {
  const done = new Set(tasks.filter((task) => task.state === 'DONE').map((task) => task.id));
  return tasks.filter(
    (task) =>
      task.state === 'READY' &&
      task.estimatedCost <= remainingBudget &&
      task.dependencies.every((dependency) => done.has(dependency)),
  );
}

function scopesOverlap(left: string[], right: string[]): boolean {
  return left.some((a) =>
    right.some((b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)),
  );
}

export function groupParallelTasks(tasks: TaskDefinition[], maxWriters = 2): TaskDefinition[][] {
  const groups: TaskDefinition[][] = [];
  for (const task of tasks) {
    const group = groups.find(
      (candidate) =>
        candidate.length < maxWriters &&
        candidate.every((peer) => !scopesOverlap(peer.writeScope, task.writeScope)),
    );
    if (group)
      group.push({
        ...task,
        parallelGroupId: group[0]?.parallelGroupId ?? `parallel-${groups.indexOf(group) + 1}`,
      });
    else groups.push([{ ...task, parallelGroupId: `parallel-${groups.length + 1}` }]);
  }
  return groups;
}

export function budgetAllows(estimatedCost: number, remainingHardBudget: number): boolean {
  return estimatedCost <= remainingHardBudget;
}

export function nextQuotaRetryAt(now: Date, attempt: number): Date {
  const minutes = [15, 30, 60][Math.min(Math.max(attempt, 0), 2)] ?? 60;
  return new Date(now.getTime() + minutes * 60_000);
}

export type MeetingContribution = { agentId: string; round: number; content: string };

export function nextMeetingRound(
  contributions: MeetingContribution[],
  maxRounds: number,
  unresolvedConflict = false,
): number | null {
  const round =
    contributions.length === 0 ? 1 : Math.max(...contributions.map((item) => item.round)) + 1;
  const allowedRounds = unresolvedConflict ? Math.min(maxRounds, 3) : Math.min(maxRounds, 2);
  return round <= allowedRounds ? round : null;
}

export function distillMeetingContext(
  contributions: MeetingContribution[],
  maxChars = 2_000,
): string {
  return contributions
    .map((item) => `[${item.agentId}/round-${item.round}] ${item.content}`)
    .join('\n')
    .slice(0, maxChars);
}

export type ResumeTrace = {
  state: 'RUNNING' | 'WAITING_PROVIDER_QUOTA' | 'COMPLETED';
  retryCount: number;
  nextRetryAt?: string;
};

export async function runWithAutomaticQuotaResume(
  runtime: AgentRuntime,
  input: RunRequest,
  waitForProbe: () => Promise<void> = async () => undefined,
): Promise<{ result: RunResult; trace: ResumeTrace }> {
  let retryCount = 0;
  try {
    return { result: await collectRun(runtime, input), trace: { state: 'COMPLETED', retryCount } };
  } catch (error) {
    if (!(error instanceof RuntimeError) || error.code !== 'QUOTA_EXHAUSTED_RESETTABLE')
      throw error;
    const nextRetryAt = nextQuotaRetryAt(new Date(), retryCount).toISOString();
    retryCount += 1;
    await waitForProbe();
    while ((await runtime.probeAvailability()) === 'WAITING') await waitForProbe();
    const capabilities = await runtime.getCapabilities();
    const result =
      error.sessionId && capabilities.resume
        ? await resumeRun(runtime, { ...input, sessionId: error.sessionId })
        : await collectRun(runtime, input);
    return { result, trace: { state: 'COMPLETED', retryCount, nextRetryAt } };
  }
}
