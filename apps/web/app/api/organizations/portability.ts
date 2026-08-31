import type { PortableOrganization } from '@bunker-studio/db';

export type OrganizationExport = {
  manifest: { schemaVersion: 1; exportedAt: string };
  organization: PortableOrganization['organization'];
  teams: PortableOrganization['teams'];
  projects: PortableOrganization['projects'];
  agents: PortableOrganization['agents'];
  assignments: NonNullable<PortableOrganization['assignments']>;
  memories: PortableOrganization['memories'];
  conversations: PortableOrganization['conversations'];
  tasks: NonNullable<PortableOrganization['tasks']>;
  providerConnections?: PortableOrganization['providerConnections'];
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function string(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function optionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || stringArray(value);
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || string(value);
}

export function parseOrganizationExport(value: unknown): OrganizationExport | null {
  if (!record(value) || !record(value.manifest) || value.manifest.schemaVersion !== 1) return null;
  if (
    !record(value.organization) ||
    !string(value.organization.id) ||
    !string(value.organization.name)
  )
    return null;
  const { teams, projects, agents, memories, conversations } = value;
  const assignments = Array.isArray(value.assignments) ? value.assignments : [];
  const tasks = Array.isArray(value.tasks) ? value.tasks : [];
  if (
    !Array.isArray(teams) ||
    !Array.isArray(projects) ||
    !Array.isArray(agents) ||
    !Array.isArray(memories) ||
    !Array.isArray(conversations) ||
    !Array.isArray(tasks) ||
    !Array.isArray(assignments)
  )
    return null;
  if (
    !teams.every((item) => record(item) && string(item.id) && string(item.name)) ||
    !projects.every(
      (item) =>
        record(item) &&
        string(item.id) &&
        string(item.name) &&
        (item.teamIds === undefined || stringArray(item.teamIds)),
    ) ||
    !agents.every(
      (item) =>
        record(item) &&
        string(item.id) &&
        string(item.name) &&
        optionalStringArray(item.skills) &&
        optionalStringArray(item.tools) &&
        optionalStringArray(item.permissions),
    ) ||
    !assignments.every(
      (item) =>
        record(item) &&
        string(item.id) &&
        string(item.agentId) &&
        (item.teamId === undefined || item.teamId === null || string(item.teamId)) &&
        (item.projectId === undefined || item.projectId === null || string(item.projectId)) &&
        (item.reportsToAgentId === undefined ||
          item.reportsToAgentId === null ||
          string(item.reportsToAgentId)),
    ) ||
    !memories.every(
      (item) =>
        record(item) &&
        string(item.id) &&
        string(item.content) &&
        ['PROJECT_KNOWLEDGE', 'DECISION', 'LESSON', 'PINNED'].includes(String(item.type)) &&
        typeof item.importance === 'number',
    ) ||
    !conversations.every((item) => record(item) && string(item.id) && stringArray(item.messages)) ||
    !tasks.every(
      (item) =>
        record(item) &&
        string(item.id) &&
        string(item.projectId) &&
        string(item.title) &&
        ['FRONTEND', 'BACKEND', 'DESIGN', 'TEST', 'DOCS', 'REVIEW'].includes(
          String(item.taskType),
        ) &&
        string(item.state) &&
        stringArray(item.dependencies) &&
        optionalStringArray(item.readScope) &&
        stringArray(item.writeScope) &&
        optionalString(item.requiredCapability) &&
        optionalString(item.parallelGroupId) &&
        optionalString(item.approvedDesignVersionId) &&
        typeof item.estimatedCost === 'number' &&
        typeof item.priority === 'number',
    )
  )
    return null;
  return {
    manifest: value.manifest as OrganizationExport['manifest'],
    organization: value.organization as OrganizationExport['organization'],
    teams: teams as OrganizationExport['teams'],
    projects: projects as OrganizationExport['projects'],
    agents: agents as OrganizationExport['agents'],
    assignments: assignments as OrganizationExport['assignments'],
    memories: memories as OrganizationExport['memories'],
    conversations: conversations as OrganizationExport['conversations'],
    tasks: tasks as OrganizationExport['tasks'],
    providerConnections: Array.isArray(value.providerConnections)
      ? (value.providerConnections as OrganizationExport['providerConnections'])
      : undefined,
  };
}
