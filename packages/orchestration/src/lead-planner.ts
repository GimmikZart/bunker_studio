import { leadPlanSchema, type LeadPlan, type LeadTask } from '@bunker-studio/contracts';
import { scopesOverlap } from './scope.js';

/**
 * The Lead proposes a decomposition; this module decides whether the proposal
 * may become work.  Every gate below is deterministic, so an unreliable or
 * adversarial model cannot widen a write scope, skip the design gate or spend
 * more than the remaining budget by phrasing its answer differently.
 */

export const MAX_LEAD_PLAN_TASKS = 24;
export const MAX_LEAD_RESPONSE_CHARACTERS = 200_000;

const MAX_PROMPT_CONSTRAINTS = 20;
const MAX_PROMPT_CAPABILITIES = 40;
const MAX_PROMPT_DESIGN_VERSIONS = 20;
const MAX_PROMPT_EXISTING_TASKS = 40;
const MAX_PROMPT_ITEM_CHARACTERS = 300;
const MAX_PROMPT_GOAL_CHARACTERS = 4_000;

/** Task types that change files and therefore require an explicit write scope. */
const WRITING_TASK_TYPES = new Set<LeadTask['taskType']>(['FRONTEND', 'BACKEND', 'TEST', 'DOCS']);
/** Task types that must stay read-only, per the reviewer/designer role contracts. */
const READ_ONLY_TASK_TYPES = new Set<LeadTask['taskType']>(['REVIEW', 'DESIGN']);

export type LeadPlanRequest = {
  goal: string;
  constraints: string[];
  teamCapabilities: string[];
  approvedDesignVersionIds: string[];
  /** Headroom under the tightest hard budget, or `null` when no hard cap applies. */
  remainingBudget: number | null;
  existingTaskTitles: string[];
};

export type LeadPlanRejection = { ok: false; reasons: string[] };
export type LeadPlanAcceptance = { ok: true; plan: LeadPlan; order: string[] };
export type LeadPlanOutcome = LeadPlanAcceptance | LeadPlanRejection;

function boundedList(values: string[], maxItems: number): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, maxItems)
    .map((value) => value.slice(0, MAX_PROMPT_ITEM_CHARACTERS));
}

function renderSection(title: string, values: string[], empty: string): string {
  if (!values.length) return `${title}\n- ${empty}`;
  return `${title}\n${values.map((value) => `- ${value}`).join('\n')}`;
}

/**
 * Builds a bounded planning prompt.  Only the current goal and the state the
 * Lead needs to decide are included: conversation history is never replayed,
 * so planning cost stays flat as a project grows.
 */
export function buildLeadPlanPrompt(request: LeadPlanRequest): string {
  const capabilities = boundedList(request.teamCapabilities, MAX_PROMPT_CAPABILITIES);
  const designVersions = boundedList(request.approvedDesignVersionIds, MAX_PROMPT_DESIGN_VERSIONS);
  return [
    'You are the Lead Architect of a software studio. Decompose the goal into an executable plan.',
    '',
    `Goal:\n${request.goal.trim().slice(0, MAX_PROMPT_GOAL_CHARACTERS)}`,
    '',
    renderSection(
      'Constraints:',
      boundedList(request.constraints, MAX_PROMPT_CONSTRAINTS),
      'none stated',
    ),
    '',
    renderSection('Team capabilities available:', capabilities, 'none declared'),
    '',
    renderSection(
      'Approved design version IDs (the only ones a FRONTEND task may reference):',
      designVersions,
      'none approved yet',
    ),
    '',
    renderSection(
      'Tasks that already exist (do not duplicate them):',
      boundedList(request.existingTaskTitles, MAX_PROMPT_EXISTING_TASKS),
      'none',
    ),
    '',
    request.remainingBudget === null
      ? 'Remaining budget for this plan: no hard cap is configured.'
      : `Remaining budget for this plan: ${request.remainingBudget}`,
    '',
    'Rules your plan MUST satisfy or it will be rejected:',
    `- At most ${MAX_LEAD_PLAN_TASKS} tasks.`,
    '- Task ids are unique, short and referenced by dependencies of later tasks only.',
    '- No task depends on itself and the dependency graph is acyclic.',
    '- FRONTEND and BACKEND tasks declare a non-empty writeScope of repository paths.',
    '- REVIEW and DESIGN tasks are read-only and declare an empty writeScope.',
    '- Every FRONTEND task sets approvedDesignVersionId to one of the approved IDs listed above.',
    '- Tasks sharing a parallelGroupId must have non-overlapping writeScope entries.',
    '- requiredCapability, when set, is one of the team capabilities listed above.',
    ...(request.remainingBudget === null
      ? []
      : ['- The sum of estimatedCost across all tasks does not exceed the remaining budget.']),
    '',
    'Answer with a single JSON object and no prose, matching exactly:',
    '{"goal":string,"assumptions":string[],"verificationSteps":string[],"tasks":[{',
    '"id":string,"title":string,"taskType":"FRONTEND"|"BACKEND"|"DESIGN"|"TEST"|"DOCS"|"REVIEW",',
    '"description":string,"dependencies":string[],"readScope":string[],"writeScope":string[],',
    '"definitionOfDone":string[],"verificationCommands":[],"estimatedCost":number,',
    '"requiredCapability"?:string,"parallelGroupId"?:string,"approvedDesignVersionId"?:string}]}',
  ].join('\n');
}

/**
 * Extracts the outermost JSON object from a model response, tolerating code
 * fences and surrounding prose without ever evaluating the text.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

export function parseLeadPlanProposal(
  text: string,
): { ok: true; plan: LeadPlan } | LeadPlanRejection {
  if (text.length > MAX_LEAD_RESPONSE_CHARACTERS)
    return { ok: false, reasons: ['The Lead response exceeded the accepted size.'] };
  const json = extractJsonObject(text);
  if (!json) return { ok: false, reasons: ['The Lead response did not contain a JSON object.'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reasons: ['The Lead response was not valid JSON.'] };
  }
  const result = leadPlanSchema.safeParse(parsed);
  if (!result.success)
    return {
      ok: false,
      reasons: result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'plan'}: ${issue.message}`,
      ),
    };
  return { ok: true, plan: result.data };
}

/**
 * Returns a dependency-safe execution order, or `null` when ids are duplicated,
 * dependencies are unknown or the graph contains a cycle.
 */
export function orderLeadPlanTasks(
  tasks: { id: string; dependencies: string[] }[],
): string[] | null {
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

function parallelGroupReasons(tasks: LeadTask[]): string[] {
  const groups = new Map<string, LeadTask[]>();
  for (const task of tasks) {
    if (!task.parallelGroupId) continue;
    const group = groups.get(task.parallelGroupId) ?? [];
    group.push(task);
    groups.set(task.parallelGroupId, group);
  }
  const reasons: string[] = [];
  for (const [groupId, members] of groups) {
    for (let index = 0; index < members.length; index += 1)
      for (let peer = index + 1; peer < members.length; peer += 1) {
        const left = members[index]!;
        const right = members[peer]!;
        if (scopesOverlap(left.writeScope, right.writeScope))
          reasons.push(
            `Parallel group "${groupId}" pairs "${left.id}" and "${right.id}" on overlapping write scopes.`,
          );
      }
  }
  return reasons;
}

/**
 * Applies every deterministic gate to a parsed plan.  A rejection lists all the
 * reasons at once so the Lead can be asked to replan without a guessing loop.
 */
export function validateLeadPlanProposal(
  plan: LeadPlan,
  context: {
    approvedDesignVersionIds: string[];
    remainingBudget: number | null;
    teamCapabilities: string[];
  },
): LeadPlanOutcome {
  const reasons: string[] = [];
  if (plan.tasks.length > MAX_LEAD_PLAN_TASKS)
    reasons.push(`A plan may contain at most ${MAX_LEAD_PLAN_TASKS} tasks.`);

  const approvedDesigns = new Set(context.approvedDesignVersionIds);
  const capabilities = new Set(context.teamCapabilities);
  for (const task of plan.tasks) {
    if (task.dependencies.includes(task.id)) reasons.push(`Task "${task.id}" depends on itself.`);
    if (WRITING_TASK_TYPES.has(task.taskType) && task.writeScope.length === 0)
      reasons.push(`Task "${task.id}" changes files but declares no write scope.`);
    if (READ_ONLY_TASK_TYPES.has(task.taskType) && task.writeScope.length > 0)
      reasons.push(`Task "${task.id}" is read-only and must not declare a write scope.`);
    if (task.taskType === 'FRONTEND' && !approvedDesigns.has(task.approvedDesignVersionId ?? ''))
      reasons.push(`Frontend task "${task.id}" does not reference an approved design version.`);
    if (task.requiredCapability && !capabilities.has(task.requiredCapability))
      reasons.push(
        `Task "${task.id}" requires capability "${task.requiredCapability}", which the team does not have.`,
      );
  }
  reasons.push(...parallelGroupReasons(plan.tasks));

  const totalCost = plan.tasks.reduce((total, task) => total + task.estimatedCost, 0);
  if (context.remainingBudget !== null && totalCost > context.remainingBudget)
    reasons.push(
      `The plan estimates ${totalCost}, above the remaining budget of ${context.remainingBudget}.`,
    );

  const order = orderLeadPlanTasks(plan.tasks);
  if (!order)
    reasons.push('The plan has duplicate ids, unknown dependencies or a dependency cycle.');

  if (reasons.length || !order) return { ok: false, reasons };
  return { ok: true, plan, order };
}
