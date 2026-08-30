import {
  type Agent,
  AuthorizationError,
  type AutonomyMode,
  canWrite,
  type Organization,
  type OrganizationMember,
  type OrganizationRole,
  type Project,
  slugify,
  type Team,
} from '@bunker-studio/core';

export const PACKAGE_NAME = '@bunker-studio/db';
export * from './secrets.js';
export * from './supabase.js';
export * from './outbox.js';
export * from './tenant-repository.js';
export * from './agent-repository.js';

export type TenantStoreState = {
  organizations: Organization[];
  members: OrganizationMember[];
  teams: Team[];
  projects: Project[];
  agents: Agent[];
};

export class TenantStore {
  private readonly state: TenantStoreState = {
    organizations: [],
    members: [],
    teams: [],
    projects: [],
    agents: [],
  };

  createOrganization(input: {
    name: string;
    ownerUserId: string;
    autonomyMode?: AutonomyMode;
  }): Organization {
    const now = new Date().toISOString();
    const organization: Organization = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      slug: slugify(input.name),
      ownerUserId: input.ownerUserId,
      defaultAutonomyMode: input.autonomyMode ?? 'AUTONOMOUS',
      archivedAt: null,
      createdAt: now,
    };
    this.state.organizations.push(organization);
    this.state.members.push({
      organizationId: organization.id,
      userId: input.ownerUserId,
      role: 'OWNER',
      createdAt: now,
    });
    return organization;
  }

  listOrganizations(userId: string): Organization[] {
    const ids = new Set(
      this.state.members
        .filter((member) => member.userId === userId)
        .map((member) => member.organizationId),
    );
    return this.state.organizations.filter(
      (organization) => ids.has(organization.id) && !organization.archivedAt,
    );
  }

  createTeam(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    description?: string;
  }): Team {
    this.requireWrite(input.organizationId, input.actorUserId);
    const team: Team = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      archivedAt: null,
    };
    this.state.teams.push(team);
    return team;
  }

  createProject(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    description?: string;
    teamId?: string;
  }): Project {
    this.requireWrite(input.organizationId, input.actorUserId);
    if (input.teamId) {
      const team = this.state.teams.find(
        (candidate) =>
          candidate.id === input.teamId && candidate.organizationId === input.organizationId,
      );
      if (!team)
        throw new AuthorizationError('The selected team does not belong to this organization.');
    }
    const project: Project = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      name: input.name.trim(),
      slug: slugify(input.name),
      description: input.description?.trim() ?? '',
      autonomyMode: 'AUTONOMOUS',
      status: 'ACTIVE',
      isStudioCore: false,
      defaultTeamId: input.teamId ?? null,
      defaultBranch: 'main',
      archivedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.state.projects.push(project);
    return project;
  }

  listTeams(organizationId: string, actorUserId: string): Team[] {
    if (!this.getRole(organizationId, actorUserId)) throw new AuthorizationError();
    return this.state.teams
      .filter((team) => team.organizationId === organizationId && !team.archivedAt)
      .map((team) => structuredClone(team));
  }

  listProjects(organizationId: string, actorUserId: string): Project[] {
    if (!this.getRole(organizationId, actorUserId)) throw new AuthorizationError();
    return this.state.projects
      .filter((project) => project.organizationId === organizationId && !project.archivedAt)
      .map((project) => structuredClone(project));
  }

  updateTeam(
    teamId: string,
    organizationId: string,
    actorUserId: string,
    patch: Partial<Pick<Team, 'name' | 'description'>>,
  ): Team {
    this.requireWrite(organizationId, actorUserId);
    const team = this.state.teams.find(
      (item) => item.id === teamId && item.organizationId === organizationId && !item.archivedAt,
    );
    if (!team) throw new AuthorizationError('Team not found.');
    if (patch.name !== undefined) team.name = patch.name.trim();
    if (patch.description !== undefined) team.description = patch.description.trim();
    return structuredClone(team);
  }

  archiveTeam(teamId: string, organizationId: string, actorUserId: string): void {
    this.requireWrite(organizationId, actorUserId);
    const team = this.state.teams.find(
      (item) => item.id === teamId && item.organizationId === organizationId,
    );
    if (!team) throw new AuthorizationError('Team not found.');
    team.archivedAt = new Date().toISOString();
  }

  updateProject(
    projectId: string,
    organizationId: string,
    actorUserId: string,
    patch: Partial<
      Pick<Project, 'name' | 'description' | 'autonomyMode' | 'status' | 'defaultBranch'> & {
        defaultTeamId: string | null;
      }
    >,
  ): Project {
    this.requireWrite(organizationId, actorUserId);
    const project = this.state.projects.find(
      (item) => item.id === projectId && item.organizationId === organizationId && !item.archivedAt,
    );
    if (!project) throw new AuthorizationError('Project not found.');
    if (patch.name !== undefined) {
      project.name = patch.name.trim();
      project.slug = slugify(patch.name);
    }
    if (patch.description !== undefined) project.description = patch.description.trim();
    if (patch.autonomyMode !== undefined) project.autonomyMode = patch.autonomyMode;
    if (patch.status !== undefined) project.status = patch.status;
    if (patch.defaultBranch !== undefined) project.defaultBranch = patch.defaultBranch.trim();
    if (patch.defaultTeamId !== undefined) project.defaultTeamId = patch.defaultTeamId;
    return structuredClone(project);
  }

  archiveProject(projectId: string, organizationId: string, actorUserId: string): void {
    this.requireWrite(organizationId, actorUserId);
    const project = this.state.projects.find(
      (item) => item.id === projectId && item.organizationId === organizationId,
    );
    if (!project) throw new AuthorizationError('Project not found.');
    if (project.isStudioCore)
      throw new AuthorizationError('The protected Studio project cannot be archived.');
    project.archivedAt = new Date().toISOString();
  }

  archiveOrganization(organizationId: string, actorUserId: string): void {
    this.requireWrite(organizationId, actorUserId);
    const organization = this.state.organizations.find(
      (candidate) => candidate.id === organizationId,
    );
    if (!organization) throw new AuthorizationError('Organization not found.');
    organization.archivedAt = new Date().toISOString();
  }

  createAgent(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    roleKey: string;
    title: string;
    providerBindingId: string;
    personality?: Record<string, unknown>;
  }): Agent {
    this.requireWrite(input.organizationId, input.actorUserId);
    const agent: Agent = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      name: input.name.trim(),
      roleKey: input.roleKey,
      title: input.title,
      personality: input.personality ?? {},
      providerBindingId: input.providerBindingId,
      archivedAt: null,
    };
    this.state.agents.push(agent);
    return agent;
  }

  listAgents(organizationId: string, actorUserId: string): Agent[] {
    if (!this.getRole(organizationId, actorUserId)) throw new AuthorizationError();
    return this.state.agents.filter(
      (agent) => agent.organizationId === organizationId && !agent.archivedAt,
    );
  }

  getAgent(agentId: string, organizationId: string, actorUserId: string): Agent {
    if (!this.getRole(organizationId, actorUserId)) throw new AuthorizationError();
    const agent = this.state.agents.find(
      (item) => item.id === agentId && item.organizationId === organizationId && !item.archivedAt,
    );
    if (!agent) throw new AuthorizationError('Agent not found.');
    return structuredClone(agent);
  }

  changeAgentBinding(
    agentId: string,
    organizationId: string,
    actorUserId: string,
    providerBindingId: string,
  ): Agent {
    this.requireWrite(organizationId, actorUserId);
    const agent = this.state.agents.find(
      (candidate) =>
        candidate.id === agentId &&
        candidate.organizationId === organizationId &&
        !candidate.archivedAt,
    );
    if (!agent) throw new AuthorizationError('Agent not found.');
    agent.providerBindingId = providerBindingId;
    return agent;
  }

  updateAgent(
    agentId: string,
    organizationId: string,
    actorUserId: string,
    patch: Partial<Pick<Agent, 'name' | 'roleKey' | 'title' | 'personality' | 'providerBindingId'>>,
  ): Agent {
    this.requireWrite(organizationId, actorUserId);
    const agent = this.state.agents.find(
      (candidate) =>
        candidate.id === agentId &&
        candidate.organizationId === organizationId &&
        !candidate.archivedAt,
    );
    if (!agent) throw new AuthorizationError('Agent not found.');
    Object.assign(agent, patch);
    return agent;
  }

  archiveAgent(agentId: string, organizationId: string, actorUserId: string): void {
    this.requireWrite(organizationId, actorUserId);
    const agent = this.state.agents.find(
      (candidate) => candidate.id === agentId && candidate.organizationId === organizationId,
    );
    if (!agent) throw new AuthorizationError('Agent not found.');
    agent.archivedAt = new Date().toISOString();
  }

  getRole(organizationId: string, userId: string): OrganizationRole | null {
    return (
      this.state.members.find(
        (member) => member.organizationId === organizationId && member.userId === userId,
      )?.role ?? null
    );
  }

  addMember(input: {
    organizationId: string;
    actorUserId: string;
    userId: string;
    role: Exclude<OrganizationRole, 'OWNER'>;
  }): OrganizationMember {
    const actorRole = this.getRole(input.organizationId, input.actorUserId);
    if (!actorRole || !canWrite(actorRole)) throw new AuthorizationError();
    const organization = this.state.organizations.find((item) => item.id === input.organizationId);
    if (!organization || organization.archivedAt)
      throw new AuthorizationError('Organization not found.');
    const existing = this.state.members.find(
      (member) => member.organizationId === input.organizationId && member.userId === input.userId,
    );
    if (existing) {
      existing.role = input.role;
      return structuredClone(existing);
    }
    const member: OrganizationMember = {
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      createdAt: new Date().toISOString(),
    };
    this.state.members.push(member);
    return structuredClone(member);
  }

  listMembers(organizationId: string, actorUserId: string): OrganizationMember[] {
    if (!this.getRole(organizationId, actorUserId)) throw new AuthorizationError();
    return this.state.members
      .filter((member) => member.organizationId === organizationId)
      .map((member) => structuredClone(member));
  }

  snapshot(): TenantStoreState {
    return structuredClone(this.state);
  }

  private requireWrite(organizationId: string, userId: string): void {
    const role = this.getRole(organizationId, userId);
    if (!role || !canWrite(role)) throw new AuthorizationError();
  }
}

export type MemoryUnit = {
  id: string;
  content: string;
  type: 'PROJECT_KNOWLEDGE' | 'DECISION' | 'LESSON' | 'PINNED';
  importance: number;
  projectId?: string;
  sourceId?: string;
  deletedAt: string | null;
};
export type ContextItem = { content: string; source: string; tokenEstimate: number };

export function retrieveBoundedContext(input: {
  task: string;
  memories: MemoryUnit[];
  recentMessages: string[];
  maxItems?: number;
  maxTokens?: number;
}): ContextItem[] {
  const maxItems = input.maxItems ?? 8;
  const maxTokens = input.maxTokens ?? 1_500;
  const terms = new Set(input.task.toLowerCase().split(/\W+/).filter(Boolean));
  const ranked = input.memories
    .filter((memory) => !memory.deletedAt)
    .map((memory) => ({
      memory,
      score:
        [...terms].filter((term) => memory.content.toLowerCase().includes(term)).length +
        memory.importance / 100,
    }))
    .sort((a, b) => b.score - a.score);
  const items: ContextItem[] = ranked.slice(0, maxItems).map(({ memory }) => ({
    content: memory.content,
    source: `memory:${memory.id}`,
    tokenEstimate: Math.ceil(memory.content.length / 4),
  }));
  for (const message of input.recentMessages.slice(-3)) {
    const item = {
      content: message,
      source: 'conversation:recent',
      tokenEstimate: Math.ceil(message.length / 4),
    };
    if (
      items.reduce((total, current) => total + current.tokenEstimate, 0) + item.tokenEstimate <=
      maxTokens
    )
      items.push(item);
  }
  return items;
}

export type WorkerNode = {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'REVOKED';
  capabilities: string[];
  lastHeartbeatAt: number;
  heartbeatIntervalMs: number;
};

export function isWorkerEligible(node: WorkerNode, now = Date.now()): boolean {
  return node.status === 'ONLINE' && now - node.lastHeartbeatAt <= node.heartbeatIntervalMs * 3;
}

export function registerWorker(name: string, capabilities: string[], now = Date.now()): WorkerNode {
  return {
    id: crypto.randomUUID(),
    name,
    status: 'ONLINE',
    capabilities: [...capabilities],
    lastHeartbeatAt: now,
    heartbeatIntervalMs: 60_000,
  };
}

export type RegisteredWorker = WorkerNode & {
  organizationId: string;
  allowedScopes: string[];
  maxConcurrent: number;
  activeJobs: number;
};

export class WorkerRegistry {
  private readonly nodes = new Map<string, RegisteredWorker>();

  register(input: {
    organizationId: string;
    name: string;
    capabilities: string[];
    allowedScopes?: string[];
    maxConcurrent?: number;
    now?: number;
  }): RegisteredWorker {
    const base = registerWorker(input.name, input.capabilities, input.now);
    const node: RegisteredWorker = {
      ...base,
      organizationId: input.organizationId,
      allowedScopes: [...(input.allowedScopes ?? [])],
      maxConcurrent: input.maxConcurrent ?? 1,
      activeJobs: 0,
    };
    this.nodes.set(node.id, node);
    return structuredClone(node);
  }

  heartbeat(nodeId: string, now = Date.now()): RegisteredWorker {
    const node = this.nodes.get(nodeId);
    if (!node || node.status === 'REVOKED') throw new Error('Worker is not active.');
    node.status = 'ONLINE';
    node.lastHeartbeatAt = now;
    return structuredClone(node);
  }

  get(nodeId: string): RegisteredWorker | null {
    const node = this.nodes.get(nodeId);
    return node ? structuredClone(node) : null;
  }

  list(organizationId: string): RegisteredWorker[] {
    return [...this.nodes.values()]
      .filter((node) => node.organizationId === organizationId)
      .map((node) => structuredClone(node));
  }

  setOffline(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node && node.status !== 'REVOKED') node.status = 'OFFLINE';
  }

  revoke(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) node.status = 'REVOKED';
  }

  findEligible(input: {
    organizationId: string;
    capability?: string;
    now?: number;
  }): RegisteredWorker | null {
    const now = input.now ?? Date.now();
    const node = [...this.nodes.values()].find(
      (candidate) =>
        candidate.organizationId === input.organizationId &&
        isWorkerEligible(candidate, now) &&
        candidate.activeJobs < candidate.maxConcurrent &&
        (!input.capability || candidate.capabilities.includes(input.capability)),
    );
    return node ? structuredClone(node) : null;
  }

  startJob(nodeId: string, now = Date.now()): RegisteredWorker {
    const node = this.nodes.get(nodeId);
    if (!node || !isWorkerEligible(node, now) || node.activeJobs >= node.maxConcurrent)
      throw new Error('Worker is not eligible for a new job.');
    node.activeJobs += 1;
    return structuredClone(node);
  }

  finishJob(nodeId: string): RegisteredWorker {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error('Worker not found.');
    node.activeJobs = Math.max(0, node.activeJobs - 1);
    return structuredClone(node);
  }
}

export type PortableOrganization = {
  organization: { id: string; name: string };
  teams: { id: string; name: string }[];
  projects: { id: string; name: string; teamId?: string }[];
  agents: {
    id: string;
    name: string;
    roleKey?: string;
    title?: string;
    personality?: Record<string, unknown>;
    providerBindingId?: string;
  }[];
  memories: MemoryUnit[];
  conversations: {
    id: string;
    agentId?: string;
    externalSessionId?: string;
    messages: string[];
  }[];
  tasks?: {
    id: string;
    projectId: string;
    title: string;
    description: string;
    taskType: string;
    state: string;
    dependencies: string[];
    writeScope: string[];
    estimatedCost: number;
    priority: number;
  }[];
  providerConnections?: { id: string; encryptedSecretBlob?: string }[];
};

export function exportOrganization(input: PortableOrganization): Record<string, unknown> {
  return {
    manifest: { schemaVersion: 1, exportedAt: new Date().toISOString() },
    organization: input.organization,
    teams: input.teams,
    projects: input.projects,
    agents: input.agents,
    memories: input.memories.filter((memory) => !memory.deletedAt),
    conversations: input.conversations,
    tasks: input.tasks ?? [],
    providerConnections: (input.providerConnections ?? []).map(({ id }) => ({
      id,
      status: 'REQUIRES_REAUTH',
    })),
  };
}

export function importOrganization(input: ReturnType<typeof exportOrganization>): {
  organizationId: string;
  idMap: Map<string, string>;
  providerStatus: 'REQUIRES_REAUTH';
} {
  const idMap = new Map<string, string>();
  const remap = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string')
      return;
    idMap.set(value.id, crypto.randomUUID());
  };
  remap(input.organization);
  for (const collection of [
    'teams',
    'projects',
    'agents',
    'memories',
    'conversations',
    'tasks',
    'providerConnections',
  ] as const) {
    for (const value of (input[collection] ?? []) as unknown[]) remap(value);
  }
  const organization = input.organization as { id?: string };
  return {
    organizationId: (organization.id && idMap.get(organization.id)) ?? crypto.randomUUID(),
    idMap,
    providerStatus: 'REQUIRES_REAUTH',
  };
}
