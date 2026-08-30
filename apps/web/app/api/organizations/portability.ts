import type { PortableOrganization } from '@bunker-studio/db';

export type OrganizationExport = {
  manifest: { schemaVersion: 1; exportedAt: string };
  organization: PortableOrganization['organization'];
  teams: PortableOrganization['teams'];
  projects: PortableOrganization['projects'];
  agents: PortableOrganization['agents'];
  memories: PortableOrganization['memories'];
  conversations: PortableOrganization['conversations'];
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

export function parseOrganizationExport(value: unknown): OrganizationExport | null {
  if (!record(value) || !record(value.manifest) || value.manifest.schemaVersion !== 1) return null;
  if (
    !record(value.organization) ||
    !string(value.organization.id) ||
    !string(value.organization.name)
  )
    return null;
  const { teams, projects, agents, memories, conversations } = value;
  if (
    !Array.isArray(teams) ||
    !Array.isArray(projects) ||
    !Array.isArray(agents) ||
    !Array.isArray(memories) ||
    !Array.isArray(conversations)
  )
    return null;
  if (
    !teams.every((item) => record(item) && string(item.id) && string(item.name)) ||
    !projects.every((item) => record(item) && string(item.id) && string(item.name)) ||
    !agents.every((item) => record(item) && string(item.id) && string(item.name)) ||
    !memories.every(
      (item) =>
        record(item) &&
        string(item.id) &&
        string(item.content) &&
        ['PROJECT_KNOWLEDGE', 'DECISION', 'LESSON', 'PINNED'].includes(String(item.type)) &&
        typeof item.importance === 'number',
    ) ||
    !conversations.every((item) => record(item) && string(item.id) && stringArray(item.messages))
  )
    return null;
  return {
    manifest: value.manifest as OrganizationExport['manifest'],
    organization: value.organization as OrganizationExport['organization'],
    teams: teams as OrganizationExport['teams'],
    projects: projects as OrganizationExport['projects'],
    agents: agents as OrganizationExport['agents'],
    memories: memories as OrganizationExport['memories'],
    conversations: conversations as OrganizationExport['conversations'],
    providerConnections: Array.isArray(value.providerConnections)
      ? (value.providerConnections as OrganizationExport['providerConnections'])
      : undefined,
  };
}
