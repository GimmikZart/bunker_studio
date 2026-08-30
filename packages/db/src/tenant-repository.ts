import {
  AuthorizationError,
  type AutonomyMode,
  type Organization,
  type OrganizationMember,
  type OrganizationRole,
  type Project,
  slugify,
  type Team,
} from '@bunker-studio/core';

export type QueryResult = { data: unknown; error: { message: string } | null };
type AsyncResult = PromiseLike<QueryResult>;
type QueryResultBuilder = PromiseLike<QueryResult> & {
  select: (columns?: string) => QueryResultBuilder;
  eq: (column: string, value: unknown) => QueryResultBuilder;
  is: (column: string, value: unknown) => QueryResultBuilder;
  maybeSingle: () => AsyncResult;
  single: () => AsyncResult;
};
type MutationBuilder = { select: (columns?: string) => QueryResultBuilder };
type QueryBuilder = {
  select: (columns?: string) => QueryResultBuilder;
  insert: (values: Record<string, unknown> | Array<Record<string, unknown>>) => MutationBuilder;
  upsert: (
    values: Record<string, unknown> | Array<Record<string, unknown>>,
    options?: Record<string, unknown>,
  ) => MutationBuilder;
  update: (values: Record<string, unknown>) => QueryResultBuilder;
};

export type SupabaseDataClient = {
  from: (table: string) => QueryBuilder;
  rpc: (functionName: string, args: Record<string, unknown>) => AsyncResult;
};

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Unexpected database response.');
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Database field ${field} is invalid.`);
  return value;
}

function mapOrganization(value: unknown): Organization {
  const item = row(value);
  return {
    id: requiredString(item.id, 'id'),
    name: requiredString(item.name, 'name'),
    slug: requiredString(item.slug, 'slug'),
    ownerUserId: requiredString(item.owner_user_id, 'owner_user_id'),
    defaultAutonomyMode: (item.default_autonomy_mode ?? 'AUTONOMOUS') as AutonomyMode,
    archivedAt: typeof item.archived_at === 'string' ? item.archived_at : null,
    createdAt: requiredString(item.created_at, 'created_at'),
  };
}

function mapTeam(value: unknown): Team {
  const item = row(value);
  return {
    id: requiredString(item.id, 'id'),
    organizationId: requiredString(item.organization_id, 'organization_id'),
    name: requiredString(item.name, 'name'),
    description: requiredString(item.description ?? '', 'description'),
    archivedAt: typeof item.archived_at === 'string' ? item.archived_at : null,
  };
}

function mapProject(value: unknown): Project {
  const item = row(value);
  return {
    id: requiredString(item.id, 'id'),
    organizationId: requiredString(item.organization_id, 'organization_id'),
    name: requiredString(item.name, 'name'),
    slug: requiredString(item.slug, 'slug'),
    description: requiredString(item.description ?? '', 'description'),
    autonomyMode: (item.autonomy_mode ?? 'AUTONOMOUS') as AutonomyMode,
    status: (item.status ?? 'ACTIVE') as Project['status'],
    isStudioCore: item.is_studio_core === true,
    defaultTeamId: typeof item.default_team_id === 'string' ? item.default_team_id : null,
    defaultBranch: requiredString(item.default_branch ?? 'main', 'default_branch'),
    archivedAt: typeof item.archived_at === 'string' ? item.archived_at : null,
    createdAt: requiredString(item.created_at, 'created_at'),
  };
}

function mapMember(value: unknown): OrganizationMember {
  const item = row(value);
  return {
    organizationId: requiredString(item.organization_id, 'organization_id'),
    userId: requiredString(item.user_id, 'user_id'),
    role: item.role as OrganizationRole,
    createdAt: requiredString(item.created_at, 'created_at'),
  };
}

async function unwrap(result: PromiseLike<QueryResult>): Promise<unknown> {
  const response = await result;
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

export class SupabaseTenancyRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  async createOrganization(input: {
    name: string;
    ownerUserId: string;
    autonomyMode?: AutonomyMode;
  }): Promise<Organization> {
    const data = await unwrap(
      this.client
        .from('organizations')
        .insert({
          name: input.name.trim(),
          slug: slugify(input.name),
          owner_user_id: input.ownerUserId,
          default_autonomy_mode: input.autonomyMode ?? 'AUTONOMOUS',
        })
        .select('*')
        .single(),
    );
    return mapOrganization(data);
  }

  async listOrganizations(userId: string): Promise<Organization[]> {
    const data = await unwrap(
      this.client
        .from('organization_members')
        .select('organization:organizations(*)')
        .eq('user_id', userId),
    );
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => row(item).organization)
      .filter((item) => item !== null)
      .map((item) => mapOrganization(item));
  }

  async getRole(organizationId: string, userId: string): Promise<OrganizationRole | null> {
    const data = await unwrap(
      this.client
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle(),
    );
    if (!data) return null;
    const role = row(data).role;
    return typeof role === 'string' ? (role as OrganizationRole) : null;
  }

  async createTeam(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    description?: string;
  }): Promise<Team> {
    await this.requireWrite(input.organizationId, input.actorUserId);
    const data = await unwrap(
      this.client
        .from('teams')
        .insert({
          organization_id: input.organizationId,
          name: input.name.trim(),
          description: input.description?.trim() ?? '',
        })
        .select('*')
        .single(),
    );
    return mapTeam(data);
  }

  async listTeams(organizationId: string, actorUserId: string): Promise<Team[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('teams').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapTeam).filter((item) => !item.archivedAt) : [];
  }

  async updateTeam(
    teamId: string,
    organizationId: string,
    actorUserId: string,
    patch: Partial<Pick<Team, 'name' | 'description'>>,
  ): Promise<Team> {
    await this.requireWrite(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('teams')
        .update({
          ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
          ...(patch.description === undefined ? {} : { description: patch.description.trim() }),
        })
        .eq('id', teamId)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .select('*')
        .maybeSingle(),
    );
    if (!data) throw new AuthorizationError('Team not found.');
    return mapTeam(data);
  }

  async createProject(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    description?: string;
    teamId?: string;
  }): Promise<Project> {
    await this.requireWrite(input.organizationId, input.actorUserId);
    const data = await unwrap(
      this.client
        .from('projects')
        .insert({
          organization_id: input.organizationId,
          name: input.name.trim(),
          slug: slugify(input.name),
          description: input.description?.trim() ?? '',
          default_team_id: input.teamId ?? null,
        })
        .select('*')
        .single(),
    );
    return mapProject(data);
  }

  async listProjects(organizationId: string, actorUserId: string): Promise<Project[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('projects').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapProject).filter((item) => !item.archivedAt) : [];
  }

  async updateProject(
    projectId: string,
    organizationId: string,
    actorUserId: string,
    patch: Partial<
      Pick<Project, 'name' | 'description' | 'autonomyMode' | 'status' | 'defaultBranch'> & {
        defaultTeamId: string | null;
      }
    >,
  ): Promise<Project> {
    await this.requireWrite(organizationId, actorUserId);
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      values.name = patch.name.trim();
      values.slug = slugify(patch.name);
    }
    if (patch.description !== undefined) values.description = patch.description.trim();
    if (patch.defaultTeamId !== undefined) values.default_team_id = patch.defaultTeamId;
    if (patch.autonomyMode !== undefined) values.autonomy_mode = patch.autonomyMode;
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.defaultBranch !== undefined) values.default_branch = patch.defaultBranch.trim();
    const data = await unwrap(
      this.client
        .from('projects')
        .update(values)
        .eq('id', projectId)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .select('*')
        .maybeSingle(),
    );
    if (!data) throw new AuthorizationError('Project not found.');
    return mapProject(data);
  }

  async addMember(input: {
    organizationId: string;
    actorUserId: string;
    userId: string;
    role: Exclude<OrganizationRole, 'OWNER'>;
  }): Promise<OrganizationMember> {
    const actorRole = await this.getRole(input.organizationId, input.actorUserId);
    if (actorRole !== 'OWNER') throw new AuthorizationError();
    const data = await unwrap(
      this.client
        .from('organization_members')
        .insert({ organization_id: input.organizationId, user_id: input.userId, role: input.role })
        .select('*')
        .single(),
    );
    return mapMember(data);
  }

  async listMembers(organizationId: string, actorUserId: string): Promise<OrganizationMember[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('organization_members').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapMember) : [];
  }

  private async requireMember(organizationId: string, userId: string): Promise<OrganizationRole> {
    const role = await this.getRole(organizationId, userId);
    if (!role) throw new AuthorizationError();
    return role;
  }

  private async requireWrite(organizationId: string, userId: string): Promise<void> {
    const role = await this.requireMember(organizationId, userId);
    if (!['OWNER', 'ADMIN'].includes(role)) throw new AuthorizationError();
  }
}
