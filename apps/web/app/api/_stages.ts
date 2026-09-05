import {
  DEFAULT_PLAYBOOK_KEY,
  projectProgress,
  type ProjectProgress,
  type TaskState,
} from '@bunker-studio/orchestration';
import { BRIEF_MEMORY_PREFIX } from './_engagement';
import type { WebAgentRepository, WebOperationalRepository } from './_data';

/**
 * The one task that writes the specification.
 *
 * Recognised by its title because a task has no field for "which stage of the
 * playbook produced me", and inventing a column to hold that would make the
 * stage a stored fact again — the very thing the derivation avoids.
 */
export const SPEC_TASK_TITLE = 'Write the technical specification';

export type ApprovedBrief = {
  understanding: string;
  proposedScope: string[];
  outOfScope: string[];
  openPoints: string[];
  playbookKey: string;
};

/** The brief the user approved for this project, if there is one. */
export async function approvedBrief(input: {
  projectId: string;
  organizationId: string;
  actorId: string;
  operations: WebOperationalRepository;
}): Promise<ApprovedBrief | null> {
  const memories = await input.operations.listMemories(input.organizationId, input.actorId);
  const memory = memories
    .filter(
      (entry) =>
        entry.projectId === input.projectId && entry.content.startsWith(BRIEF_MEMORY_PREFIX),
    )
    .at(-1);
  if (!memory) return null;
  try {
    return JSON.parse(memory.content.slice(BRIEF_MEMORY_PREFIX.length)) as ApprovedBrief;
  } catch {
    return null;
  }
}

/** Reads everything the stage derivation needs, from the facts as they are. */
export async function readProgress(input: {
  projectId: string;
  organizationId: string;
  actorId: string;
  operations: WebOperationalRepository;
}): Promise<{ progress: ProjectProgress | null; brief: ApprovedBrief | null }> {
  const { projectId, organizationId, actorId, operations } = input;
  const [brief, tasks, workflows, designs] = await Promise.all([
    approvedBrief(input),
    operations.listTasks(organizationId, actorId),
    Promise.resolve(operations.listWorkflows(organizationId, actorId)).catch(() => []),
    Promise.resolve(operations.listDesignVersions(organizationId, actorId)).catch(() => []),
  ]);
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  const spec = projectTasks.find((task) => task.title === SPEC_TASK_TITLE);
  return {
    brief,
    progress: projectProgress({
      playbookKey: brief?.playbookKey ?? DEFAULT_PLAYBOOK_KEY,
      briefApproved: Boolean(brief),
      ...(spec ? { specTask: { state: spec.state as TaskState } } : {}),
      approvedDesignVersions: designs.filter((design) => design.status === 'APPROVED').length,
      hasWorkflow: workflows.some((workflow) => workflow.projectId === projectId),
      workTasks: projectTasks
        .filter((task) => task.title !== SPEC_TASK_TITLE)
        .map((task) => ({ state: task.state as TaskState })),
    }),
  };
}

/**
 * The brief as a goal the Lead can plan against.
 *
 * Written out rather than referenced so the planning prompt carries the whole
 * agreement, including what was deliberately excluded — the part a plan is most
 * likely to quietly grow back.
 */
export function briefAsGoal(brief: ApprovedBrief): string {
  return [
    brief.understanding,
    brief.proposedScope.length
      ? `\nIn scope:\n${brief.proposedScope.map((entry) => `- ${entry}`).join('\n')}`
      : '',
    brief.outOfScope.length
      ? `\nOut of scope, and it must stay out:\n${brief.outOfScope.map((entry) => `- ${entry}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Who can actually put a file in the repository.
 *
 * A documentation task given to an agent on a plain API runtime would produce
 * the text of a document and nothing else: the task would complete, and the
 * repository would be untouched. Better to refuse and say who is missing.
 */
export async function repositoryWriter(input: {
  projectId: string;
  organizationId: string;
  actorId: string;
  agents: WebAgentRepository;
}): Promise<{ id: string; name: string } | null> {
  const [roster, assignments] = await Promise.all([
    input.agents.listAgents(input.organizationId, input.actorId),
    input.agents.listAssignments(input.organizationId, input.actorId),
  ]);
  const staffed = new Set(
    assignments
      .filter((assignment) => assignment.projectId === input.projectId)
      .map((assignment) => assignment.agentId),
  );
  const candidates = roster.filter(
    (agent) => staffed.has(agent.id) && !agent.archivedAt && agent.runtimeType === 'CODEX_SDK',
  );
  // The Lead writes the specification when it can; otherwise anyone who can
  // reach the repository will do.
  return candidates.find((agent) => agent.roleKey === 'lead') ?? candidates[0] ?? null;
}
