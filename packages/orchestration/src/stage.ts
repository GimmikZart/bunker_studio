import type { TaskState } from './index.js';
import { findPlaybook, type Playbook, type Stage } from './playbooks.js';

/**
 * Where a project has got to in its playbook.
 *
 * Derived from what exists, never stored. A remembered stage is a second copy
 * of the truth: it drifts the first time a task is cancelled or a document is
 * rejected, and then the studio confidently reports a phase the work left days
 * ago. Everything below is read from the brief, the tasks and the workflow —
 * the same facts the rest of the engine acts on.
 */

export type StageStatus = 'DONE' | 'CURRENT' | 'PENDING' | 'SKIPPED';

export type StageProgress = {
  stage: Stage;
  status: StageStatus;
  /** For the current stage: what is holding it, in the user's terms. */
  waitingFor?: string;
};

export type ProjectFacts = {
  playbookKey: string;
  briefApproved: boolean;
  /** The task that writes the specification document, if it has been created. */
  specTask?: { state: TaskState };
  approvedDesignVersions: number;
  /** Whether a plan has been committed for this project. */
  hasWorkflow: boolean;
  /** Delivery tasks other than the specification one. */
  workTasks: { state: TaskState }[];
};

const CLOSED: TaskState[] = ['DONE', 'CANCELED', 'FAILED_FINAL'];

export type ProjectProgress = {
  playbook: Playbook;
  stages: StageProgress[];
  current: StageProgress | null;
};

/**
 * Reads the state of each stage of the project's playbook.
 *
 * A stage is CURRENT when the one before it is finished and it is not; the
 * first unfinished stage is the one the studio is actually on, and it carries
 * the reason it has not moved.
 */
export function projectProgress(facts: ProjectFacts): ProjectProgress | null {
  const playbook = findPlaybook(facts.playbookKey);
  if (!playbook) return null;

  const done = (stage: Stage): boolean => {
    switch (stage.key) {
      case 'discovery':
        return facts.briefApproved;
      case 'spec':
        return facts.specTask?.state === 'DONE';
      case 'design':
      case 'prototype':
      case 'direction':
        return facts.approvedDesignVersions > 0;
      case 'decomposition':
        return facts.hasWorkflow;
      case 'execution':
        return (
          facts.workTasks.length > 0 && facts.workTasks.every((task) => CLOSED.includes(task.state))
        );
      case 'delivery':
        return false;
      default:
        return false;
    }
  };

  const waiting = (stage: Stage): string => {
    switch (stage.key) {
      case 'discovery':
        return 'Talk to the Lead until the brief is right, then approve it.';
      case 'spec':
        if (!facts.specTask) return 'Ask the Lead to write the specification.';
        return `The specification is ${facts.specTask.state.replace(/_/g, ' ').toLowerCase()}.`;
      case 'design':
      case 'prototype':
      case 'direction':
        return 'No design has been approved for this project yet.';
      case 'decomposition':
        return 'Ask the Lead for a plan, then approve it to create the work.';
      case 'execution':
        return facts.workTasks.length
          ? `${facts.workTasks.filter((task) => !CLOSED.includes(task.state)).length} task(s) still open.`
          : 'No work has been created yet.';
      case 'delivery':
        return 'Everything is done; the Lead can summarise what shipped.';
      default:
        return 'Waiting.';
    }
  };

  let currentFound = false;
  const stages: StageProgress[] = playbook.stages.map((stage) => {
    if (done(stage)) return { stage, status: 'DONE' as const };
    // An optional stage nobody asked for does not hold the project. A project
    // that needs no design should not sit on "design" forever waiting for an
    // approval that is never coming; approve one and the stage becomes done.
    if (stage.optional) return { stage, status: 'SKIPPED' as const };
    if (!currentFound) {
      currentFound = true;
      return { stage, status: 'CURRENT' as const, waitingFor: waiting(stage) };
    }
    return { stage, status: 'PENDING' as const };
  });

  return { playbook, stages, current: stages.find((entry) => entry.status === 'CURRENT') ?? null };
}

/** The stages a project has already finished, for a one-line summary. */
export function completedStageCount(progress: ProjectProgress): number {
  return progress.stages.filter((entry) => entry.status === 'DONE').length;
}
