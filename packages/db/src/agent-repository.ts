import {
  AuthorizationError,
  type Agent,
  type AgentAssignment,
  type AgentReasoningEffort,
} from '@bunker-studio/core';
import { type SupabaseDataClient, type QueryResult } from './tenant-repository.js';

async function unwrap(result: PromiseLike<QueryResult>): Promise<unknown> {
  const response = await result;
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Unexpected database response.');
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Database field ${field} is invalid.`);
  return value;
}

function mapAgent(value: unknown): Agent {
  const item = object(value);
  const bindings = Array.isArray(item.agent_bindings) ? item.agent_bindings : [];
  const binding = bindings.find((candidate) => {
    const record = object(candidate);
    return record.active_to === null || record.active_to === undefined;
  });
  const bindingRecord = binding ? object(binding) : null;
  const connection = bindingRecord?.provider_connections
    ? object(bindingRecord.provider_connections)
    : null;
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    name: stringValue(item.name, 'name'),
    roleKey: stringValue(item.role_key, 'role_key'),
    title: stringValue(item.title ?? '', 'title'),
    personality: (item.personality_json ?? {}) as Record<string, unknown>,
    avatarAssetId: typeof item.avatar_asset_id === 'string' ? item.avatar_asset_id : null,
    skills: Array.isArray(item.skills_json)
      ? item.skills_json.filter((value): value is string => typeof value === 'string')
      : [],
    tools: Array.isArray(item.tools_json)
      ? item.tools_json.filter((value): value is string => typeof value === 'string')
      : [],
    permissions: Array.isArray(item.permissions_json)
      ? item.permissions_json.filter((value): value is string => typeof value === 'string')
      : [],
    providerBindingId: bindingRecord
      ? stringValue(bindingRecord.id, 'agent_bindings.id')
      : 'unbound',
    providerConnectionId: bindingRecord
      ? stringValue(bindingRecord.provider_connection_id, 'agent_bindings.provider_connection_id')
      : 'unbound',
    providerType: connection
      ? stringValue(connection.provider_type, 'provider_connections.provider_type')
      : 'UNCONFIGURED',
    providerModelId: bindingRecord
      ? stringValue(bindingRecord.provider_model_id, 'agent_bindings.provider_model_id')
      : 'unconfigured',
    runtimeType: bindingRecord
      ? stringValue(bindingRecord.runtime_type, 'agent_bindings.runtime_type')
      : 'UNCONFIGURED',
    reasoningEffort: bindingRecord
      ? (stringValue(
          bindingRecord.reasoning_effort,
          'agent_bindings.reasoning_effort',
        ) as AgentReasoningEffort)
      : 'medium',
    archivedAt: typeof item.archived_at === 'string' ? item.archived_at : null,
  };
}

function mapAssignment(value: unknown): AgentAssignment {
  const item = object(value);
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    agentId: stringValue(item.agent_id, 'agent_id'),
    teamId: typeof item.team_id === 'string' ? item.team_id : null,
    projectId: typeof item.project_id === 'string' ? item.project_id : null,
    reportsToAgentId:
      typeof item.reports_to_agent_id === 'string' ? item.reports_to_agent_id : null,
    active: item.active !== false,
  };
}

export class SupabaseAgentRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  async listAgents(organizationId: string, actorUserId: string): Promise<Agent[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('agents')
        .select(
          '*, agent_bindings(id, provider_connection_id, provider_model_id, runtime_type, reasoning_effort, active_to, provider_connections(provider_type))',
        )
        .eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapAgent).filter((item) => !item.archivedAt) : [];
  }

  async getAgent(agentId: string, organizationId: string, actorUserId: string): Promise<Agent> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('agents')
        .select(
          '*, agent_bindings(id, provider_connection_id, provider_model_id, runtime_type, reasoning_effort, active_to, provider_connections(provider_type))',
        )
        .eq('id', agentId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
    );
    if (!data) throw new AuthorizationError('Agent not found.');
    const agent = mapAgent(data);
    if (agent.archivedAt) throw new AuthorizationError('Agent not found.');
    return agent;
  }

  async createAgent(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    roleKey: string;
    title: string;
    providerConnectionId?: string;
    providerModelId?: string;
    runtimeType?: string;
    reasoningEffort?: AgentReasoningEffort;
    personality?: Record<string, unknown>;
    avatarAssetId?: string | null;
    skills?: string[];
    tools?: string[];
    permissions?: string[];
  }): Promise<Agent> {
    await this.requireWrite(input.organizationId, input.actorUserId);
    if (
      !input.providerConnectionId ||
      !input.providerModelId ||
      !input.runtimeType ||
      !input.reasoningEffort
    ) {
      const data = await unwrap(
        this.client
          .from('agents')
          .insert({
            organization_id: input.organizationId,
            name: input.name.trim(),
            role_key: input.roleKey,
            title: input.title,
            personality_json: input.personality ?? {},
            avatar_asset_id: input.avatarAssetId ?? null,
            skills_json: input.skills ?? [],
            tools_json: input.tools ?? [],
            permissions_json: input.permissions ?? [],
          })
          .select('*')
          .single(),
      );
      return mapAgent({ ...object(data), agent_bindings: [] });
    }
    const data = await unwrap(
      this.client.rpc('create_agent_with_binding', {
        target_organization_id: input.organizationId,
        input_name: input.name.trim(),
        input_role_key: input.roleKey,
        input_title: input.title,
        input_personality_json: input.personality ?? {},
        target_provider_connection_id: input.providerConnectionId,
        target_provider_model_id: input.providerModelId,
        target_runtime_type: input.runtimeType,
        target_reasoning_effort: input.reasoningEffort,
      }),
    );
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Agent creation returned no row.');
    const capabilities = {
      avatar_asset_id: input.avatarAssetId ?? null,
      skills_json: input.skills ?? [],
      tools_json: input.tools ?? [],
      permissions_json: input.permissions ?? [],
    };
    if (input.avatarAssetId !== undefined || input.skills || input.tools || input.permissions) {
      await unwrap(
        this.client
          .from('agents')
          .update(capabilities)
          .eq('id', object(result).id)
          .eq('organization_id', input.organizationId),
      );
    }
    return mapAgent({
      ...object(result),
      ...capabilities,
      agent_bindings: [
        {
          id: object(result).provider_binding_id,
          provider_connection_id: input.providerConnectionId,
          provider_model_id: input.providerModelId,
          runtime_type: input.runtimeType,
          reasoning_effort: input.reasoningEffort,
          active_to: null,
          provider_connections: { provider_type: object(result).provider_type },
        },
      ],
    });
  }

  async updateAgent(
    agentId: string,
    organizationId: string,
    actorUserId: string,
    patch: Partial<
      Pick<
        Agent,
        | 'name'
        | 'roleKey'
        | 'title'
        | 'personality'
        | 'avatarAssetId'
        | 'skills'
        | 'tools'
        | 'permissions'
        | 'providerConnectionId'
        | 'providerModelId'
        | 'runtimeType'
        | 'reasoningEffort'
      >
    >,
  ): Promise<Agent> {
    await this.requireWrite(organizationId, actorUserId);
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) values.name = patch.name.trim();
    if (patch.roleKey !== undefined) values.role_key = patch.roleKey;
    if (patch.title !== undefined) values.title = patch.title;
    if (patch.personality !== undefined) values.personality_json = patch.personality;
    if (patch.avatarAssetId !== undefined) values.avatar_asset_id = patch.avatarAssetId;
    if (patch.skills !== undefined) values.skills_json = patch.skills;
    if (patch.tools !== undefined) values.tools_json = patch.tools;
    if (patch.permissions !== undefined) values.permissions_json = patch.permissions;
    if (Object.keys(values).length) {
      await unwrap(
        this.client
          .from('agents')
          .update(values)
          .eq('id', agentId)
          .eq('organization_id', organizationId)
          .select(
            '*, agent_bindings(id, provider_connection_id, provider_model_id, runtime_type, reasoning_effort, active_to, provider_connections(provider_type))',
          )
          .single(),
      );
    }
    if (
      patch.providerConnectionId !== undefined ||
      patch.providerModelId !== undefined ||
      patch.runtimeType !== undefined ||
      patch.reasoningEffort !== undefined
    ) {
      const current = await this.getAgent(agentId, organizationId, actorUserId);
      await unwrap(
        this.client.rpc('switch_agent_binding_v2', {
          target_agent_id: agentId,
          target_provider_connection_id: patch.providerConnectionId ?? current.providerConnectionId,
          target_provider_model_id: patch.providerModelId ?? current.providerModelId,
          target_runtime_type: patch.runtimeType ?? current.runtimeType,
          target_reasoning_effort: patch.reasoningEffort ?? current.reasoningEffort,
        }),
      );
    }
    return this.getAgent(agentId, organizationId, actorUserId);
  }

  async archiveAgent(agentId: string, organizationId: string, actorUserId: string): Promise<void> {
    await this.requireWrite(organizationId, actorUserId);
    const result = await unwrap(
      this.client
        .from('agents')
        .update({ archived_at: new Date().toISOString(), status: 'ARCHIVED' })
        .eq('id', agentId)
        .eq('organization_id', organizationId),
    );
    void result;
  }

  async createAgentAssignment(input: {
    organizationId: string;
    actorUserId: string;
    agentId: string;
    teamId?: string | null;
    projectId?: string | null;
    reportsToAgentId?: string | null;
  }): Promise<AgentAssignment> {
    await this.requireWrite(input.organizationId, input.actorUserId);
    if (!input.teamId && !input.projectId)
      throw new AuthorizationError('An assignment must reference a team or project.');
    await this.getAgent(input.agentId, input.organizationId, input.actorUserId);
    await this.requireReference('teams', input.teamId, input.organizationId, 'team');
    await this.requireReference('projects', input.projectId, input.organizationId, 'project');
    await this.requireReference(
      'agents',
      input.reportsToAgentId,
      input.organizationId,
      'reporting agent',
    );
    const data = await unwrap(
      this.client
        .from('agent_assignments')
        .insert({
          organization_id: input.organizationId,
          agent_id: input.agentId,
          team_id: input.teamId ?? null,
          project_id: input.projectId ?? null,
          reports_to_agent_id: input.reportsToAgentId ?? null,
          active: true,
        })
        .select('*')
        .single(),
    );
    return mapAssignment(data);
  }

  async listAgentAssignments(
    agentId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<AgentAssignment[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('agent_assignments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('agent_id', agentId)
        .eq('active', true),
    );
    return Array.isArray(data) ? data.map(mapAssignment) : [];
  }

  /** Every active assignment in the organization, for project-level views. */
  async listAssignments(organizationId: string, actorUserId: string): Promise<AgentAssignment[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('agent_assignments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('active', true),
    );
    return Array.isArray(data) ? data.map(mapAssignment) : [];
  }

  async archiveAgentAssignment(
    assignmentId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.requireWrite(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('agent_assignments')
        .update({ active: false })
        .eq('id', assignmentId)
        .eq('active', true)
        .select('id')
        .maybeSingle(),
    );
    if (!data) throw new AuthorizationError('Assignment not found.');
  }

  private async requireMember(organizationId: string, userId: string): Promise<string> {
    const data = await unwrap(
      this.client
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle(),
    );
    const role = data && object(data).role;
    if (typeof role !== 'string') throw new AuthorizationError();
    return role;
  }

  private async requireWrite(organizationId: string, userId: string): Promise<void> {
    const role = await this.requireMember(organizationId, userId);
    if (!['OWNER', 'ADMIN'].includes(role)) throw new AuthorizationError();
  }

  private async requireReference(
    table: string,
    id: string | null | undefined,
    organizationId: string,
    label: string,
  ): Promise<void> {
    if (!id) return;
    const data = await unwrap(
      this.client
        .from(table)
        .select('id')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .maybeSingle(),
    );
    if (!data)
      throw new AuthorizationError(`The selected ${label} does not belong to this organization.`);
  }
}
