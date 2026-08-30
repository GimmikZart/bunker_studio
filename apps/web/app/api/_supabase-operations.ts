import { AuthorizationError, type OrganizationRole } from '@bunker-studio/core';
import type { MemoryUnit, SupabaseDataClient, QueryResult } from '@bunker-studio/db';
import type {
  ApprovalRecord,
  CostRecord,
  MeetingRecord,
  NotificationRecord,
  PushSubscriptionRecord,
  RepositoryRecord,
} from './_store';

type MeetingMinutes = NonNullable<MeetingRecord['minutes']>;

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

function nullableString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function mapMeeting(value: unknown): MeetingRecord {
  const item = object(value);
  const participants = Array.isArray(item.meeting_participants) ? item.meeting_participants : [];
  const contributions = Array.isArray(item.meeting_contributions)
    ? item.meeting_contributions
        .map((entry) => object(entry))
        .filter((entry) => typeof entry.agent_id === 'string')
        .map((entry) => ({
          agentId: stringValue(entry.agent_id, 'meeting_contributions.agent_id'),
          round: typeof entry.round === 'number' ? entry.round : 0,
          content: stringValue(entry.content ?? '', 'meeting_contributions.content'),
        }))
    : [];
  const minuteRows = Array.isArray(item.meeting_minutes)
    ? item.meeting_minutes
    : item.meeting_minutes
      ? [item.meeting_minutes]
      : [];
  const minute = minuteRows[0] ? object(minuteRows[0]) : null;
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    projectId: stringValue(item.project_id, 'project_id'),
    title: stringValue(item.title, 'title'),
    meetingType: stringValue(item.meeting_type, 'meeting_type'),
    agenda: Array.isArray(item.agenda_json)
      ? item.agenda_json.filter((entry): entry is string => typeof entry === 'string')
      : [],
    agentIds: participants
      .map((entry) => object(entry).agent_id)
      .filter((entry): entry is string => typeof entry === 'string'),
    maxRounds: typeof item.max_rounds === 'number' ? item.max_rounds : 2,
    status: item.status === 'RUNNING' || item.status === 'COMPLETED' ? item.status : 'DRAFT',
    contributions,
    minutes: minute
      ? {
          summary: stringValue(minute.summary ?? '', 'meeting_minutes.summary'),
          decisions: Array.isArray(minute.decisions_json)
            ? (minute.decisions_json as MeetingMinutes['decisions'])
            : [],
          actionItems: Array.isArray(minute.action_items_json)
            ? (minute.action_items_json as MeetingMinutes['actionItems'])
            : [],
        }
      : null,
    cost: typeof item.cost === 'number' ? item.cost : Number(item.cost ?? 0),
    createdAt: stringValue(item.created_at, 'created_at'),
  };
}

function mapApproval(value: unknown): ApprovalRecord {
  const item = object(value);
  const risk = object(item.risk_json ?? {});
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    approvalType: stringValue(item.approval_type, 'approval_type'),
    subjectType: stringValue(item.subject_type, 'subject_type'),
    subjectId: stringValue(item.subject_id, 'subject_id'),
    title: stringValue(risk.title ?? item.subject_type, 'risk_json.title'),
    risk: risk.risk === 'LOW' || risk.risk === 'CRITICAL' ? risk.risk : 'HIGH',
    status: item.status === 'APPROVED' || item.status === 'REJECTED' ? item.status : 'PENDING',
    requestedByUserId: stringValue(item.requested_by_user_id, 'requested_by_user_id'),
    resolvedByUserId: nullableString(item.resolved_by_user_id),
    resolutionNote: nullableString(item.resolution_note),
    createdAt: stringValue(item.created_at, 'created_at'),
    resolvedAt: nullableString(item.resolved_at),
  };
}

function mapCost(value: unknown): CostRecord {
  const item = object(value);
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    amount: Number(item.amount ?? 0),
    occurredAt: stringValue(item.occurred_at, 'occurred_at'),
    provider: stringValue(item.provider_type, 'provider_type'),
    model: stringValue(item.provider_model_id, 'provider_model_id'),
    projectId: nullableString(item.project_id),
    taskId: nullableString(item.task_id),
    agentId: nullableString(item.agent_id),
    meetingId: nullableString(item.meeting_id),
  };
}

function mapNotification(value: unknown): NotificationRecord {
  const item = object(value);
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    userId: stringValue(item.user_id, 'user_id'),
    category: item.category as NotificationRecord['category'],
    severity: item.severity as NotificationRecord['severity'],
    title: stringValue(item.title, 'title'),
    body: stringValue(item.body, 'body'),
    deepLink: stringValue(item.deep_link, 'deep_link'),
    readAt: typeof item.read_at === 'string' ? item.read_at : null,
    createdAt: stringValue(item.created_at, 'created_at'),
  };
}

function mapRepository(value: unknown): RepositoryRecord {
  const item = object(value);
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    projectId: stringValue(item.project_id, 'project_id'),
    providerType: item.provider_type as RepositoryRecord['providerType'],
    owner: stringValue(item.repo_owner, 'repo_owner'),
    name: stringValue(item.repo_name, 'repo_name'),
    defaultBranch: stringValue(item.default_branch, 'default_branch'),
    status: item.status === 'CONNECTED' ? 'CONNECTED' : 'REQUIRES_AUTH',
  };
}

function mapMemory(value: unknown): MemoryUnit {
  const item = object(value);
  return {
    id: stringValue(item.id, 'id'),
    content: stringValue(item.content, 'content'),
    type: item.memory_type as MemoryUnit['type'],
    importance: typeof item.importance === 'number' ? item.importance : 50,
    projectId: nullableString(item.project_id),
    sourceId: nullableString(item.source_id),
    deletedAt: typeof item.deleted_at === 'string' ? item.deleted_at : null,
  };
}

export class SupabaseOperationalRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  async getRole(organizationId: string, userId: string): Promise<OrganizationRole | null> {
    const data = await unwrap(
      this.client
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle(),
    );
    const role = data && object(data).role;
    return typeof role === 'string' ? (role as OrganizationRole) : null;
  }

  async listMeetings(organizationId: string, actorUserId: string): Promise<MeetingRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('meetings')
        .select(
          '*, meeting_participants(agent_id), meeting_contributions(agent_id,round,content), meeting_minutes(summary,decisions_json,action_items_json)',
        )
        .eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapMeeting) : [];
  }

  async createMeeting(
    input: Omit<
      MeetingRecord,
      'id' | 'status' | 'contributions' | 'minutes' | 'cost' | 'createdAt'
    >,
    actorUserId: string,
  ): Promise<MeetingRecord> {
    await this.requireMember(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('meetings')
        .insert({
          organization_id: input.organizationId,
          project_id: input.projectId,
          title: input.title,
          meeting_type: input.meetingType,
          agenda_json: input.agenda,
          max_rounds: input.maxRounds,
          created_by_user_id: actorUserId,
          status: 'DRAFT',
        })
        .select('*')
        .single(),
    );
    const meeting = object(data);
    if (input.agentIds.length) {
      await unwrap(
        this.client
          .from('meeting_participants')
          .insert(
            input.agentIds.map((agentId) => ({
              meeting_id: meeting.id,
              agent_id: agentId,
              participant_type: 'AGENT',
            })),
          )
          .select('*'),
      );
    }
    return mapMeeting({
      ...meeting,
      meeting_participants: input.agentIds.map((agentId) => ({ agent_id: agentId })),
    });
  }

  async getMeeting(
    organizationId: string,
    meetingId: string,
    actorUserId: string,
  ): Promise<MeetingRecord | null> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('meetings')
        .select(
          '*, meeting_participants(agent_id), meeting_contributions(agent_id,round,content), meeting_minutes(summary,decisions_json,action_items_json)',
        )
        .eq('organization_id', organizationId)
        .eq('id', meetingId)
        .maybeSingle(),
    );
    return data ? mapMeeting(data) : null;
  }

  async updateMeeting(
    organizationId: string,
    meeting: MeetingRecord,
    actorUserId: string,
  ): Promise<MeetingRecord> {
    await this.requireMember(organizationId, actorUserId);
    const meetingValues: Record<string, unknown> = { status: meeting.status, cost: meeting.cost };
    if (meeting.status === 'RUNNING') meetingValues.started_at = new Date().toISOString();
    if (meeting.status === 'COMPLETED') meetingValues.ended_at = new Date().toISOString();
    const data = await unwrap(
      this.client
        .from('meetings')
        .update(meetingValues)
        .eq('organization_id', organizationId)
        .eq('id', meeting.id)
        .select('*')
        .single(),
    );
    if (meeting.status === 'COMPLETED') {
      if (meeting.contributions.length) {
        await unwrap(
          this.client
            .from('meeting_contributions')
            .insert(
              meeting.contributions.map((contribution) => ({
                organization_id: organizationId,
                meeting_id: meeting.id,
                participant_type: 'AGENT',
                agent_id: contribution.agentId,
                round: contribution.round,
                content: contribution.content,
              })),
            )
            .select('*'),
        );
      }
      if (meeting.minutes) {
        await unwrap(
          this.client
            .from('meeting_minutes')
            .insert({
              meeting_id: meeting.id,
              summary: meeting.minutes.summary,
              decisions_json: meeting.minutes.decisions,
              action_items_json: meeting.minutes.actionItems,
            })
            .select('*')
            .single(),
        );
      }
    }
    void data;
    return (await this.getMeeting(organizationId, meeting.id, actorUserId)) ?? meeting;
  }

  async listApprovals(organizationId: string, actorUserId: string): Promise<ApprovalRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('approvals').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapApproval) : [];
  }

  async createApproval(
    input: Omit<ApprovalRecord, 'id' | 'status' | 'createdAt'>,
    actorUserId: string,
  ): Promise<ApprovalRecord> {
    await this.requireMember(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('approvals')
        .insert({
          organization_id: input.organizationId,
          approval_type: input.approvalType,
          subject_type: input.subjectType,
          subject_id: input.subjectId,
          requested_by_user_id: input.requestedByUserId,
          risk_json: { risk: input.risk, title: input.title },
          status: 'PENDING',
        })
        .select('*')
        .single(),
    );
    return mapApproval(data);
  }

  async resolveApproval(
    organizationId: string,
    approvalId: string,
    status: 'APPROVED' | 'REJECTED',
    resolvedByUserId: string,
    resolutionNote?: string,
  ): Promise<ApprovalRecord | null> {
    await this.requireWrite(organizationId, resolvedByUserId);
    const data = await unwrap(
      this.client
        .from('approvals')
        .update({
          status,
          resolved_by_user_id: resolvedByUserId,
          resolution_note: resolutionNote ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId)
        .eq('id', approvalId)
        .eq('status', 'PENDING')
        .select('*')
        .maybeSingle(),
    );
    return data ? mapApproval(data) : null;
  }

  async listCosts(organizationId: string, actorUserId: string): Promise<CostRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('cost_ledger').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapCost) : [];
  }

  async addCost(input: Omit<CostRecord, 'id'>, actorUserId: string): Promise<CostRecord> {
    await this.requireWrite(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('cost_ledger')
        .insert({
          organization_id: input.organizationId,
          amount: input.amount,
          occurred_at: input.occurredAt,
          provider_type: input.provider,
          provider_model_id: input.model,
          project_id: input.projectId ?? null,
          task_id: input.taskId ?? null,
          agent_id: input.agentId ?? null,
          meeting_id: input.meetingId ?? null,
          confidence: 'ESTIMATED',
        })
        .select('*')
        .single(),
    );
    return mapCost(data);
  }

  async listNotifications(
    userId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<NotificationRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('notifications')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId),
    );
    return Array.isArray(data) ? data.map(mapNotification) : [];
  }

  async addNotification(
    input: Omit<NotificationRecord, 'id' | 'readAt' | 'createdAt'>,
    actorUserId: string,
  ): Promise<NotificationRecord> {
    await this.requireMember(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('notifications')
        .insert({
          organization_id: input.organizationId,
          user_id: input.userId,
          category: input.category,
          severity: input.severity,
          title: input.title,
          body: input.body,
          deep_link: input.deepLink,
        })
        .select('*')
        .single(),
    );
    return mapNotification(data);
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    const data = await unwrap(
      this.client
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle(),
    );
    return Boolean(data);
  }

  async savePushSubscription(
    userId: string,
    input: Omit<PushSubscriptionRecord, 'createdAt'>,
  ): Promise<PushSubscriptionRecord> {
    const data = await unwrap(
      this.client
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint: input.endpoint,
            p256dh: input.p256dh,
            auth: input.auth,
            user_agent: '',
          },
          { onConflict: 'user_id,endpoint' },
        )
        .select('*')
        .single(),
    );
    const item = object(data);
    return {
      endpoint: stringValue(item.endpoint, 'endpoint'),
      p256dh: stringValue(item.p256dh, 'p256dh'),
      auth: stringValue(item.auth, 'auth'),
      createdAt: stringValue(item.created_at, 'created_at'),
    };
  }

  async getRepository(
    projectId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<RepositoryRecord | null> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('repo_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('project_id', projectId)
        .maybeSingle(),
    );
    return data ? mapRepository(data) : null;
  }

  async saveRepository(input: RepositoryRecord, actorUserId: string): Promise<RepositoryRecord> {
    await this.requireWrite(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('repo_connections')
        .upsert(
          {
            organization_id: input.organizationId,
            project_id: input.projectId,
            provider_type: input.providerType,
            repo_owner: input.owner,
            repo_name: input.name,
            repo_external_id: `${input.owner}/${input.name}`,
            default_branch: input.defaultBranch,
            status: input.status,
          },
          { onConflict: 'organization_id,project_id' } as unknown as Record<string, unknown>,
        )
        .select('*')
        .single(),
    );
    return mapRepository(data);
  }

  async addMemory(
    organizationId: string,
    input: Omit<MemoryUnit, 'id' | 'deletedAt'>,
    actorUserId: string,
  ): Promise<MemoryUnit> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('memories')
        .insert({
          organization_id: organizationId,
          project_id: input.projectId ?? null,
          memory_type: input.type,
          title: input.type,
          content: input.content,
          importance: input.importance,
          source_id: input.sourceId ?? null,
        })
        .select('*')
        .single(),
    );
    return mapMemory(data);
  }

  async listMemories(organizationId: string, actorUserId: string): Promise<MemoryUnit[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('memories').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapMemory).filter((item) => !item.deletedAt) : [];
  }

  async deleteMemory(
    organizationId: string,
    memoryId: string,
    actorUserId: string,
  ): Promise<boolean> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('memories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('id', memoryId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle(),
    );
    return Boolean(data);
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
