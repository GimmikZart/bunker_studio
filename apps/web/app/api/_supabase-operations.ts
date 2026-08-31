import { AuthorizationError, type DesignRecord, type OrganizationRole } from '@bunker-studio/core';
import { canTransition, type TaskState } from '@bunker-studio/orchestration';
import type {
  MemoryUnit,
  RegisteredWorker,
  SupabaseDataClient,
  QueryResult,
} from '@bunker-studio/db';
import type {
  ApprovalRecord,
  CostRecord,
  MeetingRecord,
  NotificationRecord,
  NotificationPreferences,
  ConversationRecord,
  PushSubscriptionRecord,
  RepositoryRecord,
  TaskRecord,
  TaskCreateRecord,
  ReviewRecord,
  VerificationRunRecord,
  ActivityRecord,
  WorkflowRecord,
} from './_store';
import type { ReviewFinding } from '@bunker-studio/contracts';

type MeetingMinutes = NonNullable<MeetingRecord['minutes']>;
export type ProviderRecord = {
  id: string;
  providerType: string;
  displayName: string;
  status: string;
  capabilities: string[];
  models: string[];
  lastVerifiedAt: string | undefined;
};

const defaultNotificationPreferences: NotificationPreferences = {
  APPROVAL: true,
  SECURITY: true,
  BUDGET: true,
  QUOTA: true,
  WORKFLOW: true,
};

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

function mapActivity(value: unknown): ActivityRecord {
  const item = object(value);
  return {
    id: stringValue(item.id, 'id'),
    eventType: stringValue(item.event_type, 'event_type'),
    aggregateType: stringValue(item.aggregate_type, 'aggregate_type'),
    aggregateId: stringValue(item.aggregate_id, 'aggregate_id'),
    payload:
      item.payload_json && typeof item.payload_json === 'object'
        ? (item.payload_json as Record<string, unknown>)
        : {},
    createdAt: stringValue(item.created_at, 'created_at'),
  };
}

function mapTask(value: unknown): TaskRecord {
  const item = object(value);
  const dependencies = Array.isArray(item.task_dependencies) ? item.task_dependencies : [];
  const readScope = Array.isArray(item.read_scope_json) ? item.read_scope_json : [];
  const writeScope = Array.isArray(item.write_scope_json) ? item.write_scope_json : [];
  const definition = object(item.definition_of_done_json ?? {});
  const definitionItems = Array.isArray(definition.items) ? definition.items : [];
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    projectId: stringValue(item.project_id, 'project_id'),
    ...(typeof item.workflow_id === 'string' ? { workflowId: item.workflow_id } : {}),
    title: stringValue(item.title, 'title'),
    description: stringValue(item.description ?? '', 'description'),
    taskType: item.task_type as TaskRecord['taskType'],
    state: stringValue(item.state, 'state'),
    dependencies: dependencies
      .map((entry) => object(entry).depends_on_task_id)
      .filter((entry): entry is string => typeof entry === 'string'),
    readScope: readScope.filter((entry): entry is string => typeof entry === 'string'),
    writeScope: writeScope.filter((entry): entry is string => typeof entry === 'string'),
    ...(typeof item.required_capability === 'string'
      ? { requiredCapability: item.required_capability }
      : {}),
    ...(typeof item.parallel_group_id === 'string'
      ? { parallelGroupId: item.parallel_group_id }
      : {}),
    definitionOfDone: definitionItems.filter(
      (entry: unknown): entry is string => typeof entry === 'string',
    ),
    estimatedCost: Number(definition.estimated_cost ?? 0),
    priority: typeof item.priority === 'number' ? item.priority : 0,
    createdAt: stringValue(item.created_at, 'created_at'),
  };
}

function mapWorkflow(value: unknown): WorkflowRecord {
  const item = object(value);
  const plan = object(item.plan_json ?? {});
  const taskIds = Array.isArray(item.task_ids_json) ? item.task_ids_json : [];
  const assumptions = Array.isArray(plan.assumptions) ? plan.assumptions : [];
  const verificationSteps = Array.isArray(plan.verificationSteps) ? plan.verificationSteps : [];
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    projectId: stringValue(item.project_id, 'project_id'),
    goal: stringValue(item.goal, 'goal'),
    assumptions: assumptions.filter((entry): entry is string => typeof entry === 'string'),
    verificationSteps: verificationSteps.filter(
      (entry): entry is string => typeof entry === 'string',
    ),
    taskIds: taskIds.filter((entry): entry is string => typeof entry === 'string'),
    rootTaskId: typeof item.root_task_id === 'string' ? item.root_task_id : null,
    status:
      item.status === 'RUNNING' || item.status === 'COMPLETED' || item.status === 'FAILED'
        ? item.status
        : 'IDLE',
    createdByUserId: stringValue(item.created_by_user_id, 'created_by_user_id'),
    createdAt: stringValue(item.created_at, 'created_at'),
  };
}

function mapVerificationRun(value: unknown): VerificationRunRecord {
  const item = object(value);
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    taskId: stringValue(item.task_id, 'task_id'),
    kind: item.kind as VerificationRunRecord['kind'],
    commandOrCheck: stringValue(item.command_or_check, 'command_or_check'),
    status: item.status as VerificationRunRecord['status'],
    artifactId: nullableString(item.artifact_id),
    durationMs: Number(item.duration_ms ?? 0),
    executedAt: stringValue(item.executed_at, 'executed_at'),
  };
}

function mapReviewFinding(value: unknown): ReviewFinding {
  const item = object(value);
  return {
    severity: item.severity as ReviewFinding['severity'],
    category: item.category as ReviewFinding['category'],
    title: stringValue(item.title, 'review_findings.title'),
    description: stringValue(item.description, 'review_findings.description'),
    evidence: stringValue(item.evidence, 'review_findings.evidence'),
    filePath: nullableString(item.file_path),
    symbol: nullableString(item.symbol),
    recommendation: stringValue(item.recommendation, 'review_findings.recommendation'),
    blocking: item.blocking === true,
    confidence: Number(item.confidence ?? 0),
  };
}

function mapReview(value: unknown): ReviewRecord {
  const item = object(value);
  const findings = Array.isArray(item.review_findings)
    ? item.review_findings.map(mapReviewFinding)
    : [];
  return {
    id: stringValue(item.id, 'id'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    projectId: stringValue(item.project_id, 'project_id'),
    taskId: nullableString(item.task_id),
    reviewerAgentId: stringValue(item.reviewer_agent_id, 'reviewer_agent_id'),
    candidateSha: stringValue(item.candidate_sha, 'candidate_sha'),
    status: item.status === 'PASS' ? 'PASS' : 'FIX_REQUIRED',
    summary: stringValue(item.summary ?? '', 'summary'),
    findings,
    createdAt: stringValue(item.created_at, 'created_at'),
    completedAt: stringValue(item.completed_at ?? item.created_at, 'completed_at'),
  };
}

function mapDesign(value: unknown): DesignRecord {
  const item = object(value);
  const spec = item.spec_json;
  return {
    id: stringValue(item.id, 'id'),
    version: typeof item.version_number === 'number' ? item.version_number : 0,
    status: item.status as DesignRecord['status'],
    spec: spec && typeof spec === 'object' ? (spec as Record<string, unknown>) : {},
    approvedAt: nullableString(item.approved_at),
    approvedBy: nullableString(item.approved_by),
  };
}

function mapWorker(value: unknown): RegisteredWorker {
  const item = object(value);
  const heartbeat =
    typeof item.last_heartbeat_at === 'string' ? Date.parse(item.last_heartbeat_at) : 0;
  const capabilitiesValue = object(item.capabilities_json ?? {});
  const scopesValue = object(item.allowed_scopes_json ?? {});
  return {
    id: stringValue(item.id, 'id'),
    name: stringValue(item.name, 'name'),
    organizationId: stringValue(item.organization_id, 'organization_id'),
    status:
      item.status === 'REVOKED' ? 'REVOKED' : item.status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
    capabilities: Array.isArray(capabilitiesValue.items)
      ? capabilitiesValue.items.filter((entry): entry is string => typeof entry === 'string')
      : [],
    allowedScopes: Array.isArray(scopesValue.items)
      ? scopesValue.items.filter((entry): entry is string => typeof entry === 'string')
      : [],
    maxConcurrent: typeof item.max_concurrent === 'number' ? item.max_concurrent : 1,
    activeJobs: typeof item.active_jobs === 'number' ? item.active_jobs : 0,
    lastHeartbeatAt: Number.isNaN(heartbeat) ? 0 : heartbeat,
    heartbeatIntervalMs: 60_000,
  };
}

function mapProvider(value: unknown): ProviderRecord {
  const item = object(value);
  const capabilities = object(item.capabilities_json ?? {});
  const models = Array.isArray(item.model_catalog) ? item.model_catalog : [];
  return {
    id: stringValue(item.id, 'id'),
    providerType: stringValue(item.provider_type, 'provider_type'),
    displayName: stringValue(item.display_name, 'display_name'),
    status: stringValue(item.status, 'status'),
    capabilities: Array.isArray(capabilities.items)
      ? capabilities.items.filter((entry): entry is string => typeof entry === 'string')
      : [],
    models: models
      .map((entry) => object(entry).provider_model_id)
      .filter((entry): entry is string => typeof entry === 'string'),
    lastVerifiedAt: nullableString(item.last_verified_at),
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

  async listProviders(organizationId: string, actorUserId: string): Promise<ProviderRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('provider_connections')
        .select('*, model_catalog(provider_model_id)')
        .eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapProvider) : [];
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

  async getNotificationPreferences(
    organizationId: string,
    userId: string,
    actorUserId: string,
  ): Promise<NotificationPreferences> {
    await this.requireMember(organizationId, actorUserId);
    if (userId !== actorUserId) throw new AuthorizationError();
    const data = await unwrap(
      this.client
        .from('notification_preferences')
        .select('category, enabled')
        .eq('organization_id', organizationId)
        .eq('user_id', userId),
    );
    const preferences = { ...defaultNotificationPreferences };
    if (Array.isArray(data)) {
      for (const value of data) {
        const item = object(value);
        const category = item.category;
        if (typeof category === 'string' && category in preferences)
          preferences[category as keyof NotificationPreferences] = item.enabled === true;
      }
    }
    return preferences;
  }

  async saveNotificationPreferences(
    organizationId: string,
    userId: string,
    preferences: NotificationPreferences,
    actorUserId: string,
  ): Promise<NotificationPreferences> {
    await this.requireMember(organizationId, actorUserId);
    if (userId !== actorUserId) throw new AuthorizationError();
    await unwrap(
      this.client
        .from('notification_preferences')
        .upsert(
          Object.entries(preferences).map(([category, enabled]) => ({
            organization_id: organizationId,
            user_id: userId,
            category,
            enabled,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'organization_id,user_id,category' },
        )
        .select('*'),
    );
    return this.getNotificationPreferences(organizationId, userId, actorUserId);
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

  async listDesignVersions(organizationId: string, actorUserId: string): Promise<DesignRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('design_versions').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapDesign) : [];
  }

  async submitDesignVersion(
    organizationId: string,
    input: Pick<DesignRecord, 'version' | 'spec'> & {
      rationale?: string;
      previewArtifactIds?: string[];
    },
    actorUserId: string,
  ): Promise<DesignRecord> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('design_versions')
        .insert({
          organization_id: organizationId,
          design_request_id: null,
          version_number: input.version,
          status: 'SUBMITTED',
          spec_json: input.spec,
          rationale: input.rationale ?? '',
          preview_artifact_ids: input.previewArtifactIds ?? [],
        })
        .select('*')
        .single(),
    );
    return mapDesign(data);
  }

  async approveDesignVersion(
    organizationId: string,
    versionId: string,
    actorUserId: string,
  ): Promise<DesignRecord[]> {
    const role = await this.requireMember(organizationId, actorUserId);
    if (role !== 'OWNER') throw new AuthorizationError('Owner approval is required.');
    const versions = await this.listDesignVersions(organizationId, actorUserId);
    const target = versions.find(
      (version) => version.id === versionId && version.status === 'SUBMITTED',
    );
    if (!target) throw new Error('Only a submitted design version can be approved.');
    const approvedAt = new Date().toISOString();
    for (const version of versions) {
      const patch =
        version.id === versionId
          ? { status: 'APPROVED', approved_at: approvedAt, approved_by: actorUserId }
          : version.status === 'APPROVED'
            ? { status: 'SUPERSEDED' }
            : null;
      if (patch) {
        await unwrap(
          this.client
            .from('design_versions')
            .update(patch)
            .eq('id', version.id)
            .eq('organization_id', organizationId),
        );
      }
    }
    return this.listDesignVersions(organizationId, actorUserId);
  }

  async registerWorker(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    capabilities: string[];
    allowedScopes?: string[];
    maxConcurrent?: number;
  }): Promise<RegisteredWorker> {
    await this.requireMember(input.organizationId, input.actorUserId);
    const data = await unwrap(
      this.client
        .from('worker_nodes')
        .insert({
          organization_id: input.organizationId,
          node_type: 'LOCAL',
          name: input.name.trim(),
          status: 'ONLINE',
          credential_hash: crypto.randomUUID(),
          capabilities_json: { items: input.capabilities },
          allowed_scopes_json: { items: input.allowedScopes ?? [] },
          max_concurrent: input.maxConcurrent ?? 1,
          active_jobs: 0,
          last_heartbeat_at: new Date().toISOString(),
        })
        .select('*')
        .single(),
    );
    return mapWorker(data);
  }

  async getWorker(
    nodeId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<RegisteredWorker | null> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('worker_nodes')
        .select('*')
        .eq('id', nodeId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
    );
    return data ? mapWorker(data) : null;
  }

  async listWorkers(organizationId: string, actorUserId: string): Promise<RegisteredWorker[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('worker_nodes').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapWorker) : [];
  }

  async heartbeatWorker(
    nodeId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<RegisteredWorker> {
    await this.requireMember(organizationId, actorUserId);
    const current = await this.getWorker(nodeId, organizationId, actorUserId);
    if (!current || current.status === 'REVOKED') throw new Error('Worker is not active.');
    const data = await unwrap(
      this.client
        .from('worker_nodes')
        .update({ status: 'ONLINE', last_heartbeat_at: new Date().toISOString() })
        .eq('id', nodeId)
        .eq('organization_id', organizationId)
        .select('*')
        .single(),
    );
    return mapWorker(data);
  }

  async recordChat(
    input: {
      organizationId: string;
      agentId: string;
      externalSessionId: string;
      userContent: string;
      assistantContent: string;
      provider: string;
    },
    actorUserId: string,
  ): Promise<void> {
    await this.requireMember(input.organizationId, actorUserId);
    const existing = await unwrap(
      this.client
        .from('conversations')
        .select('*')
        .eq('organization_id', input.organizationId)
        .eq('primary_agent_id', input.agentId)
        .eq('external_session_id', input.externalSessionId)
        .maybeSingle(),
    );
    const conversation = existing
      ? object(existing)
      : object(
          await unwrap(
            this.client
              .from('conversations')
              .insert({
                organization_id: input.organizationId,
                conversation_type: 'DIRECT_CHAT',
                primary_agent_id: input.agentId,
                title: 'Direct chat',
                external_session_id: input.externalSessionId,
              })
              .select('*')
              .single(),
          ),
        );
    await unwrap(
      this.client
        .from('messages')
        .insert([
          {
            organization_id: input.organizationId,
            conversation_id: conversation.id,
            sender_type: 'USER',
            sender_user_id: actorUserId,
            content_json: { text: input.userContent },
          },
          {
            organization_id: input.organizationId,
            conversation_id: conversation.id,
            sender_type: 'AGENT',
            sender_agent_id: input.agentId,
            content_json: { text: input.assistantContent },
            provider_metadata: { provider: input.provider },
          },
        ])
        .select('*'),
    );
  }

  async listConversations(
    organizationId: string,
    actorUserId: string,
  ): Promise<ConversationRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('conversations')
        .select(
          'id, organization_id, primary_agent_id, external_session_id, messages(content_json)',
        )
        .eq('organization_id', organizationId),
    );
    if (!Array.isArray(data)) return [];
    return data.map((value) => {
      const item = object(value);
      const messages = Array.isArray(item.messages)
        ? item.messages
            .map((message) => object(message).content_json)
            .map((content) => (content && typeof content === 'object' ? object(content).text : ''))
            .filter((content): content is string => typeof content === 'string')
        : [];
      return {
        id: stringValue(item.id, 'id'),
        organizationId: stringValue(item.organization_id, 'organization_id'),
        agentId: stringValue(item.primary_agent_id, 'primary_agent_id'),
        externalSessionId: nullableString(item.external_session_id) ?? '',
        messages,
      };
    });
  }

  async importConversation(
    input: Omit<ConversationRecord, 'id'>,
    actorUserId: string,
  ): Promise<ConversationRecord> {
    await this.requireMember(input.organizationId, actorUserId);
    const conversation = object(
      await unwrap(
        this.client
          .from('conversations')
          .insert({
            organization_id: input.organizationId,
            conversation_type: 'DIRECT_CHAT',
            primary_agent_id: input.agentId,
            title: 'Imported direct chat',
            external_session_id: input.externalSessionId || null,
          })
          .select('*')
          .single(),
      ),
    );
    if (input.messages.length) {
      await unwrap(
        this.client
          .from('messages')
          .insert(
            input.messages.map((content, index) => ({
              organization_id: input.organizationId,
              conversation_id: conversation.id,
              sender_type: index % 2 === 0 ? 'USER' : 'AGENT',
              sender_user_id: index % 2 === 0 ? actorUserId : null,
              sender_agent_id: index % 2 === 0 ? null : input.agentId,
              content_json: { text: content },
            })),
          )
          .select('*'),
      );
    }
    return {
      id: stringValue(conversation.id, 'id'),
      organizationId: input.organizationId,
      agentId: input.agentId,
      externalSessionId: input.externalSessionId,
      messages: [...input.messages],
    };
  }

  async listActivity(organizationId: string, actorUserId: string): Promise<ActivityRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('domain_events').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapActivity) : [];
  }

  async recordActivity(input: {
    organizationId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await unwrap(
      this.client
        .from('domain_events')
        .insert({
          organization_id: input.organizationId,
          aggregate_type: input.aggregateType,
          aggregate_id: input.aggregateId,
          event_type: input.eventType,
          payload_json: input.payload ?? {},
          correlation_id: crypto.randomUUID(),
        })
        .select('*'),
    );
  }

  async listTasks(organizationId: string, actorUserId: string): Promise<TaskRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('tasks')
        .select('*, task_dependencies(depends_on_task_id)')
        .eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapTask) : [];
  }

  async listWorkflows(organizationId: string, actorUserId: string): Promise<WorkflowRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    const data = await unwrap(
      this.client.from('workflows').select('*').eq('organization_id', organizationId),
    );
    return Array.isArray(data) ? data.map(mapWorkflow) : [];
  }

  async createWorkflow(
    input: {
      organizationId: string;
      projectId: string;
      plan: { goal: string; assumptions: string[]; verificationSteps: string[] };
      createdByUserId: string;
    },
    actorUserId: string,
  ): Promise<WorkflowRecord> {
    await this.requireMember(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('workflows')
        .insert({
          organization_id: input.organizationId,
          project_id: input.projectId,
          goal: input.plan.goal,
          status: 'IDLE',
          created_by_user_id: input.createdByUserId,
          plan_json: {
            assumptions: input.plan.assumptions,
            verificationSteps: input.plan.verificationSteps,
          },
          task_ids_json: [],
        })
        .select('*')
        .single(),
    );
    return mapWorkflow(data);
  }

  async updateWorkflowTasks(
    organizationId: string,
    workflowId: string,
    taskIds: string[],
    rootTaskId: string | null,
    actorUserId: string,
  ): Promise<WorkflowRecord> {
    await this.requireWrite(organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('workflows')
        .update({ task_ids_json: taskIds, root_task_id: rootTaskId })
        .eq('id', workflowId)
        .eq('organization_id', organizationId)
        .select('*')
        .single(),
    );
    return mapWorkflow(data);
  }

  async createTask(input: TaskCreateRecord, actorUserId: string): Promise<TaskRecord> {
    await this.requireMember(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('tasks')
        .insert({
          ...(input.id ? { id: input.id } : {}),
          organization_id: input.organizationId,
          project_id: input.projectId,
          ...(input.workflowId ? { workflow_id: input.workflowId } : {}),
          title: input.title,
          description: input.description,
          task_type: input.taskType,
          state: 'DRAFT',
          priority: input.priority,
          read_scope_json: input.readScope ?? [],
          write_scope_json: input.writeScope,
          ...(input.requiredCapability ? { required_capability: input.requiredCapability } : {}),
          ...(input.parallelGroupId ? { parallel_group_id: input.parallelGroupId } : {}),
          definition_of_done_json: {
            estimated_cost: input.estimatedCost,
            items: input.definitionOfDone ?? [],
          },
        })
        .select('*')
        .single(),
    );
    const task = object(data);
    if (input.dependencies.length) {
      await unwrap(
        this.client
          .from('task_dependencies')
          .insert(
            input.dependencies.map((dependency) => ({
              task_id: task.id,
              depends_on_task_id: dependency,
            })),
          )
          .select('*'),
      );
    }
    return mapTask({
      ...task,
      task_dependencies: input.dependencies.map((dependency) => ({
        depends_on_task_id: dependency,
      })),
    });
  }

  async transitionTask(
    taskId: string,
    organizationId: string,
    state: TaskState,
    actorUserId: string,
  ): Promise<TaskRecord> {
    await this.requireWrite(organizationId, actorUserId);
    const current = await unwrap(
      this.client
        .from('tasks')
        .select('*, task_dependencies(depends_on_task_id)')
        .eq('id', taskId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
    );
    if (!current) throw new AuthorizationError('Task not found.');
    const task = mapTask(current);
    if (!canTransition(task.state as TaskState, state)) throw new Error('Invalid task transition.');
    const data = await unwrap(
      this.client
        .from('tasks')
        .update({ state })
        .eq('id', taskId)
        .eq('organization_id', organizationId)
        .select('*')
        .single(),
    );
    return mapTask({
      ...object(data),
      task_dependencies: task.dependencies.map((dependency) => ({
        depends_on_task_id: dependency,
      })),
    });
  }

  async listVerificationRuns(
    organizationId: string,
    actorUserId: string,
    taskId?: string,
  ): Promise<VerificationRunRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    let query = this.client
      .from('verification_runs')
      .select('*')
      .eq('organization_id', organizationId);
    if (taskId) query = query.eq('task_id', taskId);
    const data = await unwrap(query);
    return Array.isArray(data) ? data.map(mapVerificationRun) : [];
  }

  async addVerificationRun(
    input: Omit<VerificationRunRecord, 'id' | 'executedAt'>,
    actorUserId: string,
  ): Promise<VerificationRunRecord> {
    await this.requireWrite(input.organizationId, actorUserId);
    const data = await unwrap(
      this.client
        .from('verification_runs')
        .insert({
          organization_id: input.organizationId,
          task_id: input.taskId,
          kind: input.kind,
          command_or_check: input.commandOrCheck,
          status: input.status,
          artifact_id: input.artifactId ?? null,
          duration_ms: input.durationMs,
        })
        .select('*')
        .single(),
    );
    return mapVerificationRun(data);
  }

  async listReviews(
    organizationId: string,
    actorUserId: string,
    taskId?: string,
  ): Promise<ReviewRecord[]> {
    await this.requireMember(organizationId, actorUserId);
    let query = this.client
      .from('reviews')
      .select('*, review_findings(*)')
      .eq('organization_id', organizationId);
    if (taskId) query = query.eq('task_id', taskId);
    const data = await unwrap(query);
    return Array.isArray(data) ? data.map(mapReview) : [];
  }

  async addReview(
    input: Omit<ReviewRecord, 'id' | 'createdAt' | 'completedAt'>,
    actorUserId: string,
  ): Promise<ReviewRecord> {
    await this.requireWrite(input.organizationId, actorUserId);
    const now = new Date().toISOString();
    const data = await unwrap(
      this.client
        .from('reviews')
        .insert({
          organization_id: input.organizationId,
          project_id: input.projectId,
          task_id: input.taskId ?? null,
          reviewer_agent_id: input.reviewerAgentId,
          candidate_sha: input.candidateSha,
          status: input.status,
          summary: input.summary,
          completed_at: now,
        })
        .select('*')
        .single(),
    );
    const review = object(data);
    if (input.findings.length) {
      await unwrap(
        this.client
          .from('review_findings')
          .insert(
            input.findings.map((finding) => ({
              review_id: review.id,
              severity: finding.severity,
              category: finding.category,
              title: finding.title,
              description: finding.description,
              evidence: finding.evidence,
              file_path: finding.filePath ?? null,
              symbol: finding.symbol ?? null,
              recommendation: finding.recommendation,
              blocking: finding.blocking,
              confidence: finding.confidence,
            })),
          )
          .select('*'),
      );
    }
    return mapReview({ ...review, review_findings: input.findings });
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
