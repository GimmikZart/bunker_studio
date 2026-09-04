/**
 * The vocabulary the studio itself uses for agent capabilities.
 *
 * Only `roleKey` changes what the system does on its own: a review can be
 * generated exclusively by an agent whose role key is `reviewer`, and the office
 * view groups agents by role. Skills, tools and permissions are declarations
 * that travel with every run this agent performs; they are not an access
 * control list, so this file exists to offer the identifiers that mean
 * something to the rest of the studio rather than leaving four empty boxes.
 */

export type Choice = { id: string; label: string; description: string };

export const ROLE_CHOICES: (Choice & { title: string })[] = [
  {
    id: 'lead',
    label: 'Lead',
    title: 'Lead Architect / Orchestrator',
    description: 'Can draft the plan that turns a goal into tasks, and chairs meetings.',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    title: 'Frontend Engineer',
    description: 'Implementation work on interfaces.',
  },
  {
    id: 'backend',
    label: 'Backend',
    title: 'Backend Engineer',
    description: 'Implementation work on services and data.',
  },
  {
    id: 'reviewer',
    label: 'Reviewer / QA',
    title: 'Reviewer / QA / Security',
    description: 'The only role allowed to produce a review of a candidate branch.',
  },
  {
    id: 'designer',
    label: 'Designer',
    title: 'Product Designer',
    description: 'Produces design proposals for approval.',
  },
  {
    id: 'hr',
    label: 'HR / Staffing',
    title: 'HR / Staffing',
    description: 'Proposes who to hire for a goal.',
  },
];

export const TOOL_CHOICES: Choice[] = [
  {
    id: 'repository.workspace',
    label: 'repository.workspace',
    description: 'Declares that this agent works inside a checked-out repository on a worker.',
  },
  {
    id: 'repository.read',
    label: 'repository.read',
    description: 'Declares reading of repository contents without changing them.',
  },
  {
    id: 'ci.read',
    label: 'ci.read',
    description: 'Declares reading of continuous-integration results for a commit.',
  },
  {
    id: 'project.read',
    label: 'project.read',
    description: 'Declares reading of project metadata: goals, tasks, teams.',
  },
  {
    id: 'task.plan',
    label: 'task.plan',
    description: 'Declares producing a task breakdown from a goal.',
  },
  {
    id: 'design.read',
    label: 'design.read',
    description: 'Declares reading of design versions and their previews.',
  },
  {
    id: 'artifact.write',
    label: 'artifact.write',
    description: 'Declares producing stored artifacts such as previews or reports.',
  },
  {
    id: 'agent.read',
    label: 'agent.read',
    description: 'Declares reading of the roster of agents and their capabilities.',
  },
];

export const PERMISSION_CHOICES: Choice[] = [
  {
    id: 'repo.read',
    label: 'repo.read',
    description: 'The agent is expected to read repository content.',
  },
  {
    id: 'artifact.write',
    label: 'artifact.write',
    description: 'The agent is expected to write artifacts.',
  },
  {
    id: 'task.plan',
    label: 'task.plan',
    description: 'The agent is expected to draft plans.',
  },
  {
    id: 'task.assign',
    label: 'task.assign',
    description: 'The agent is expected to propose who does what.',
  },
  {
    id: 'design.write',
    label: 'design.write',
    description: 'The agent is expected to submit design versions.',
  },
  {
    id: 'agent.recommend',
    label: 'agent.recommend',
    description: 'The agent is expected to recommend hires.',
  },
];

/** Common skills. Skills are free text by design; these are only a starting set. */
export const SKILL_SUGGESTIONS = [
  'planning',
  'architecture',
  'coordination',
  'frontend',
  'backend',
  'api-design',
  'accessibility',
  'testing',
  'review',
  'security',
  'quality-assurance',
  'product-design',
  'ux',
  'design-system',
  'staffing',
  'cost-analysis',
  'documentation',
];
