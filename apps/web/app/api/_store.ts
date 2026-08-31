import { TenantStore, WorkerRegistry } from '@bunker-studio/db';
import type { BudgetPolicy, CostEntry, DesignRecord } from '@bunker-studio/core';
import type { LeadPlan, ReviewFinding, VerificationRun } from '@bunker-studio/contracts';
import type { MemoryUnit } from '@bunker-studio/db';

type WebRuntimeState = {
  tenantStore: TenantStore;
  workerRegistry: WorkerRegistry;
  memories: Map<string, MemoryUnit[]>;
  designs: Map<string, DesignRecord[]>;
  meetings: Map<string, MeetingRecord[]>;
  approvals: Map<string, ApprovalRecord[]>;
  costs: Map<string, CostRecord[]>;
  notifications: Map<string, NotificationRecord[]>;
  notificationPreferences: Map<string, NotificationPreferences>;
  conversations: Map<string, ConversationRecord[]>;
  verificationRuns: Map<string, VerificationRunRecord[]>;
  reviews: Map<string, ReviewRecord[]>;
  pushSubscriptions: Map<string, PushSubscriptionRecord[]>;
  repositories: Map<string, RepositoryRecord>;
  tasks: Map<string, TaskRecord[]>;
  activity: Map<string, ActivityRecord[]>;
  workflows: Map<string, WorkflowRecord[]>;
  budgetPolicies: Map<string, BudgetPolicyRecord[]>;
  reportSchedules: Map<string, ReportScheduleRecord>;
};

type GlobalWithRuntime = typeof globalThis & { __bunkerStudioRuntime?: WebRuntimeState };
const globalRuntime = globalThis as GlobalWithRuntime;
const state = (globalRuntime.__bunkerStudioRuntime ??= {
  tenantStore: new TenantStore(),
  workerRegistry: new WorkerRegistry(),
  memories: new Map<string, MemoryUnit[]>(),
  designs: new Map<string, DesignRecord[]>(),
  meetings: new Map<string, MeetingRecord[]>(),
  approvals: new Map<string, ApprovalRecord[]>(),
  costs: new Map<string, CostRecord[]>(),
  notifications: new Map<string, NotificationRecord[]>(),
  notificationPreferences: new Map<string, NotificationPreferences>(),
  conversations: new Map<string, ConversationRecord[]>(),
  verificationRuns: new Map<string, VerificationRunRecord[]>(),
  reviews: new Map<string, ReviewRecord[]>(),
  pushSubscriptions: new Map<string, PushSubscriptionRecord[]>(),
  repositories: new Map<string, RepositoryRecord>(),
  tasks: new Map<string, TaskRecord[]>(),
  activity: new Map<string, ActivityRecord[]>(),
  workflows: new Map<string, WorkflowRecord[]>(),
  budgetPolicies: new Map<string, BudgetPolicyRecord[]>(),
  reportSchedules: new Map<string, ReportScheduleRecord>(),
});
state.notificationPreferences ??= new Map<string, NotificationPreferences>();
state.conversations ??= new Map<string, ConversationRecord[]>();
state.verificationRuns ??= new Map<string, VerificationRunRecord[]>();
state.reviews ??= new Map<string, ReviewRecord[]>();
state.activity ??= new Map<string, ActivityRecord[]>();
state.workflows ??= new Map<string, WorkflowRecord[]>();
state.budgetPolicies ??= new Map<string, BudgetPolicyRecord[]>();
state.reportSchedules ??= new Map<string, ReportScheduleRecord>();

export const tenantStore = state.tenantStore;
export const workerRegistry = state.workerRegistry;

export type ActivityRecord = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export function addActivity(input: {
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
}): ActivityRecord {
  const record: ActivityRecord = {
    id: crypto.randomUUID(),
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: structuredClone(input.payload ?? {}),
    createdAt: new Date().toISOString(),
  };
  state.activity.set(input.organizationId, [
    ...(state.activity.get(input.organizationId) ?? []),
    record,
  ]);
  return structuredClone(record);
}

export function listActivity(organizationId: string): ActivityRecord[] {
  return structuredClone(state.activity.get(organizationId) ?? []);
}

export type WorkflowRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  goal: string;
  assumptions: string[];
  verificationSteps: string[];
  taskIds: string[];
  rootTaskId: string | null;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdByUserId: string;
  createdAt: string;
};

export function createWorkflow(input: {
  organizationId: string;
  projectId: string;
  plan: Pick<LeadPlan, 'goal' | 'assumptions' | 'verificationSteps'>;
  createdByUserId: string;
}): WorkflowRecord {
  const workflow: WorkflowRecord = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    projectId: input.projectId,
    goal: input.plan.goal,
    assumptions: [...input.plan.assumptions],
    verificationSteps: [...input.plan.verificationSteps],
    taskIds: [],
    rootTaskId: null,
    status: 'IDLE',
    createdByUserId: input.createdByUserId,
    createdAt: new Date().toISOString(),
  };
  state.workflows.set(input.organizationId, [
    ...(state.workflows.get(input.organizationId) ?? []),
    workflow,
  ]);
  return structuredClone(workflow);
}

export function listWorkflows(organizationId: string): WorkflowRecord[] {
  return structuredClone(state.workflows.get(organizationId) ?? []);
}

export function updateWorkflowTasks(
  organizationId: string,
  workflowId: string,
  taskIds: string[],
  rootTaskId: string | null,
): WorkflowRecord {
  const workflow = (state.workflows.get(organizationId) ?? []).find(
    (item) => item.id === workflowId,
  );
  if (!workflow) throw new Error('Workflow not found.');
  workflow.taskIds = [...taskIds];
  workflow.rootTaskId = rootTaskId;
  return structuredClone(workflow);
}

export function addMemory(
  organizationId: string,
  input: Omit<MemoryUnit, 'id' | 'deletedAt'>,
): MemoryUnit {
  const memory: MemoryUnit = { ...input, id: crypto.randomUUID(), deletedAt: null };
  state.memories.set(organizationId, [...(state.memories.get(organizationId) ?? []), memory]);
  return structuredClone(memory);
}

export function getMemories(organizationId: string): MemoryUnit[] {
  return structuredClone(state.memories.get(organizationId) ?? []);
}

export function deleteMemory(organizationId: string, memoryId: string): boolean {
  const current = state.memories.get(organizationId) ?? [];
  const target = current.find((memory) => memory.id === memoryId && !memory.deletedAt);
  if (!target) return false;
  target.deletedAt = new Date().toISOString();
  return true;
}

export function submitDesignVersion(
  organizationId: string,
  input: Pick<DesignRecord, 'version' | 'spec'>,
): DesignRecord {
  const versions = state.designs.get(organizationId) ?? [];
  const record: DesignRecord = {
    id: crypto.randomUUID(),
    version: input.version,
    status: 'SUBMITTED',
    spec: structuredClone(input.spec),
  };
  state.designs.set(organizationId, [...versions, record]);
  return record;
}

export function listDesignVersions(organizationId: string): DesignRecord[] {
  return structuredClone(state.designs.get(organizationId) ?? []);
}

export function replaceDesignVersions(organizationId: string, versions: DesignRecord[]): void {
  state.designs.set(organizationId, structuredClone(versions));
}

export type MeetingContributionRecord = {
  agentId: string;
  round: number;
  content: string;
};

export type MeetingRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  meetingType: string;
  agenda: string[];
  agentIds: string[];
  maxRounds: number;
  status: 'DRAFT' | 'RUNNING' | 'COMPLETED';
  contributions: MeetingContributionRecord[];
  minutes: {
    summary: string;
    decisions: { title: string; decision: string }[];
    actionItems: { title: string; ownerAgentId?: string }[];
  } | null;
  cost: number;
  createdAt: string;
};

export type ApprovalRecord = {
  id: string;
  organizationId: string;
  approvalType: string;
  subjectType: string;
  subjectId: string;
  title: string;
  risk: 'LOW' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedByUserId: string;
  resolvedByUserId?: string;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
};

export type CostRecord = CostEntry & {
  id: string;
  organizationId: string;
  projectId?: string;
  taskId?: string;
  agentId?: string;
  meetingId?: string;
};

export type BudgetPolicyRecord = BudgetPolicy & {
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type ReportScheduleRecord = {
  id: string;
  organizationId: string;
  frequency: 'WEEKLY';
  dayOfWeek: number;
  hourUtc: number;
  minuteUtc: number;
  timezone: string;
  recipients: string[];
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRecord = {
  id: string;
  organizationId: string;
  userId: string;
  category: 'APPROVAL' | 'SECURITY' | 'BUDGET' | 'QUOTA' | 'WORKFLOW';
  severity: 'LOW' | 'HIGH' | 'CRITICAL';
  title: string;
  body: string;
  deepLink: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPreferences = Record<NotificationRecord['category'], boolean>;

export type ConversationRecord = {
  id: string;
  organizationId: string;
  agentId: string;
  externalSessionId: string;
  messages: string[];
};

export const defaultNotificationPreferences: NotificationPreferences = {
  APPROVAL: true,
  SECURITY: true,
  BUDGET: true,
  QUOTA: true,
  WORKFLOW: true,
};

function notificationPreferencesKey(organizationId: string, userId: string): string {
  return `${organizationId}:${userId}`;
}

export function getNotificationPreferences(
  organizationId: string,
  userId: string,
): NotificationPreferences {
  return structuredClone(
    state.notificationPreferences.get(notificationPreferencesKey(organizationId, userId)) ??
      defaultNotificationPreferences,
  );
}

export function saveNotificationPreferences(
  organizationId: string,
  userId: string,
  preferences: NotificationPreferences,
): NotificationPreferences {
  const next = { ...defaultNotificationPreferences, ...preferences };
  state.notificationPreferences.set(notificationPreferencesKey(organizationId, userId), next);
  return structuredClone(next);
}

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
};

export type RepositoryRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  providerType: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
  owner: string;
  name: string;
  defaultBranch: string;
  status: 'CONNECTED' | 'REQUIRES_AUTH';
};

export type TaskRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  workflowId?: string;
  title: string;
  description: string;
  taskType: 'FRONTEND' | 'BACKEND' | 'DESIGN' | 'TEST' | 'DOCS' | 'REVIEW';
  state: string;
  dependencies: string[];
  readScope?: string[];
  writeScope: string[];
  requiredCapability?: string;
  parallelGroupId?: string;
  approvedDesignVersionId?: string;
  definitionOfDone?: string[];
  estimatedCost: number;
  priority: number;
  createdAt: string;
};

export type TaskCreateRecord = Omit<TaskRecord, 'id' | 'state' | 'createdAt'> & { id?: string };

export type VerificationRunRecord = VerificationRun & {
  id: string;
  organizationId: string;
  taskId: string;
  executedAt: string;
};

export type ReviewRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  taskId?: string;
  reviewerAgentId: string;
  candidateSha: string;
  status: 'PASS' | 'FIX_REQUIRED';
  summary: string;
  findings: ReviewFinding[];
  createdAt: string;
  completedAt: string;
};

export function createMeeting(
  input: Omit<MeetingRecord, 'id' | 'status' | 'contributions' | 'minutes' | 'cost' | 'createdAt'>,
): MeetingRecord {
  const meeting: MeetingRecord = {
    ...input,
    id: crypto.randomUUID(),
    status: 'DRAFT',
    contributions: [],
    minutes: null,
    cost: 0,
    createdAt: new Date().toISOString(),
  };
  state.meetings.set(input.organizationId, [
    ...(state.meetings.get(input.organizationId) ?? []),
    meeting,
  ]);
  return structuredClone(meeting);
}

export function listMeetings(organizationId: string): MeetingRecord[] {
  return structuredClone(state.meetings.get(organizationId) ?? []);
}

export function getMeeting(organizationId: string, meetingId: string): MeetingRecord | null {
  const meeting = (state.meetings.get(organizationId) ?? []).find((item) => item.id === meetingId);
  return meeting ? structuredClone(meeting) : null;
}

export function updateMeeting(organizationId: string, meeting: MeetingRecord): MeetingRecord {
  const meetings = state.meetings.get(organizationId) ?? [];
  const index = meetings.findIndex((item) => item.id === meeting.id);
  if (index < 0) throw new Error('Meeting not found.');
  meetings[index] = structuredClone(meeting);
  return structuredClone(meeting);
}

export function listApprovals(organizationId: string): ApprovalRecord[] {
  return structuredClone(state.approvals.get(organizationId) ?? []);
}

export function createApproval(
  input: Omit<ApprovalRecord, 'id' | 'status' | 'createdAt'>,
): ApprovalRecord {
  const approval: ApprovalRecord = {
    ...input,
    id: crypto.randomUUID(),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  state.approvals.set(input.organizationId, [
    ...(state.approvals.get(input.organizationId) ?? []),
    approval,
  ]);
  return structuredClone(approval);
}

export function resolveApproval(
  organizationId: string,
  approvalId: string,
  status: 'APPROVED' | 'REJECTED',
  resolvedByUserId: string,
  resolutionNote?: string,
): ApprovalRecord | null {
  const approval = (state.approvals.get(organizationId) ?? []).find(
    (item) => item.id === approvalId,
  );
  if (!approval || approval.status !== 'PENDING') return null;
  approval.status = status;
  approval.resolvedByUserId = resolvedByUserId;
  approval.resolutionNote = resolutionNote;
  approval.resolvedAt = new Date().toISOString();
  return structuredClone(approval);
}

export function addCost(input: Omit<CostRecord, 'id'>): CostRecord {
  const cost = { ...input, id: crypto.randomUUID() };
  state.costs.set(input.organizationId, [...(state.costs.get(input.organizationId) ?? []), cost]);
  return structuredClone(cost);
}

export function listCosts(organizationId: string): CostRecord[] {
  return structuredClone(state.costs.get(organizationId) ?? []);
}

export function listBudgetPolicies(organizationId: string): BudgetPolicyRecord[] {
  return structuredClone(state.budgetPolicies.get(organizationId) ?? []);
}

export function createBudgetPolicy(
  organizationId: string,
  input: Omit<BudgetPolicy, 'id'>,
): BudgetPolicyRecord {
  const now = new Date().toISOString();
  const policy: BudgetPolicyRecord = {
    ...input,
    id: crypto.randomUUID(),
    organizationId,
    createdAt: now,
    updatedAt: now,
  };
  state.budgetPolicies.set(organizationId, [
    ...(state.budgetPolicies.get(organizationId) ?? []),
    policy,
  ]);
  return structuredClone(policy);
}

export function updateBudgetPolicy(
  organizationId: string,
  policyId: string,
  patch: Partial<Omit<BudgetPolicy, 'id'>>,
): BudgetPolicyRecord | null {
  const policies = state.budgetPolicies.get(organizationId) ?? [];
  const policy = policies.find((item) => item.id === policyId);
  if (!policy) return null;
  Object.assign(policy, patch, { updatedAt: new Date().toISOString() });
  return structuredClone(policy);
}

export function deleteBudgetPolicy(organizationId: string, policyId: string): boolean {
  const policies = state.budgetPolicies.get(organizationId) ?? [];
  const next = policies.filter((policy) => policy.id !== policyId);
  if (next.length === policies.length) return false;
  state.budgetPolicies.set(organizationId, next);
  return true;
}

export function getReportSchedule(organizationId: string): ReportScheduleRecord | null {
  const schedule = state.reportSchedules.get(organizationId);
  return schedule ? structuredClone(schedule) : null;
}

export function saveReportSchedule(
  organizationId: string,
  input: Omit<
    ReportScheduleRecord,
    'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'lastRunAt'
  > & { lastRunAt?: string | null },
): ReportScheduleRecord {
  const previous = state.reportSchedules.get(organizationId);
  const now = new Date().toISOString();
  const schedule: ReportScheduleRecord = {
    ...input,
    id: previous?.id ?? crypto.randomUUID(),
    organizationId,
    lastRunAt: input.lastRunAt ?? previous?.lastRunAt ?? null,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  state.reportSchedules.set(organizationId, schedule);
  return structuredClone(schedule);
}

export function addNotification(
  input: Omit<NotificationRecord, 'id' | 'readAt' | 'createdAt'>,
): NotificationRecord {
  const notification = {
    ...input,
    id: crypto.randomUUID(),
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  state.notifications.set(input.userId, [
    ...(state.notifications.get(input.userId) ?? []),
    notification,
  ]);
  return structuredClone(notification);
}

export function listNotifications(userId: string, organizationId: string): NotificationRecord[] {
  return structuredClone(
    (state.notifications.get(userId) ?? []).filter(
      (item) => item.organizationId === organizationId,
    ),
  );
}

export function markNotificationRead(userId: string, notificationId: string): boolean {
  const notification = (state.notifications.get(userId) ?? []).find(
    (item) => item.id === notificationId,
  );
  if (!notification) return false;
  notification.readAt = new Date().toISOString();
  return true;
}

export function savePushSubscription(
  userId: string,
  input: Omit<PushSubscriptionRecord, 'createdAt'>,
): PushSubscriptionRecord {
  const subscription = { ...input, createdAt: new Date().toISOString() };
  const current = state.pushSubscriptions.get(userId) ?? [];
  state.pushSubscriptions.set(userId, [
    ...current.filter((item) => item.endpoint !== input.endpoint),
    subscription,
  ]);
  return structuredClone(subscription);
}

export function recordConversation(
  input: Omit<ConversationRecord, 'id' | 'messages'> & { messages: string[] },
): ConversationRecord {
  const current = state.conversations.get(input.organizationId) ?? [];
  const existing = current.find(
    (conversation) =>
      conversation.agentId === input.agentId &&
      conversation.externalSessionId === input.externalSessionId,
  );
  if (existing) {
    existing.messages.push(...input.messages);
    return structuredClone(existing);
  }
  const conversation: ConversationRecord = { ...input, id: crypto.randomUUID() };
  state.conversations.set(input.organizationId, [...current, conversation]);
  return structuredClone(conversation);
}

export function listConversations(organizationId: string): ConversationRecord[] {
  return structuredClone(state.conversations.get(organizationId) ?? []);
}

export function importConversation(input: Omit<ConversationRecord, 'id'>): ConversationRecord {
  const conversation: ConversationRecord = { ...input, id: crypto.randomUUID() };
  state.conversations.set(input.organizationId, [
    ...(state.conversations.get(input.organizationId) ?? []),
    conversation,
  ]);
  return structuredClone(conversation);
}

export function saveRepository(input: RepositoryRecord): RepositoryRecord {
  state.repositories.set(input.projectId, structuredClone(input));
  return structuredClone(input);
}

export function getRepository(projectId: string): RepositoryRecord | null {
  const repository = state.repositories.get(projectId);
  return repository ? structuredClone(repository) : null;
}

export function createTask(input: TaskCreateRecord): TaskRecord {
  const task: TaskRecord = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    state: 'DRAFT',
    createdAt: new Date().toISOString(),
  };
  state.tasks.set(input.organizationId, [...(state.tasks.get(input.organizationId) ?? []), task]);
  return structuredClone(task);
}

export function listTasks(organizationId: string): TaskRecord[] {
  return structuredClone(state.tasks.get(organizationId) ?? []);
}

export function updateTask(organizationId: string, task: TaskRecord): TaskRecord {
  const tasks = state.tasks.get(organizationId) ?? [];
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index < 0) throw new Error('Task not found.');
  tasks[index] = structuredClone(task);
  return structuredClone(task);
}

export function addVerificationRun(
  input: Omit<VerificationRunRecord, 'id' | 'executedAt'>,
): VerificationRunRecord {
  const run: VerificationRunRecord = {
    ...input,
    id: crypto.randomUUID(),
    executedAt: new Date().toISOString(),
  };
  state.verificationRuns.set(input.organizationId, [
    ...(state.verificationRuns.get(input.organizationId) ?? []),
    run,
  ]);
  return structuredClone(run);
}

export function listVerificationRuns(
  organizationId: string,
  taskId?: string,
): VerificationRunRecord[] {
  return structuredClone(
    (state.verificationRuns.get(organizationId) ?? []).filter(
      (run) => !taskId || run.taskId === taskId,
    ),
  );
}

export function addReview(
  input: Omit<ReviewRecord, 'id' | 'createdAt' | 'completedAt'>,
): ReviewRecord {
  const now = new Date().toISOString();
  const review: ReviewRecord = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    completedAt: now,
  };
  state.reviews.set(input.organizationId, [
    ...(state.reviews.get(input.organizationId) ?? []),
    review,
  ]);
  return structuredClone(review);
}

export function listReviews(organizationId: string, taskId?: string): ReviewRecord[] {
  return structuredClone(
    (state.reviews.get(organizationId) ?? []).filter(
      (review) => !taskId || review.taskId === taskId,
    ),
  );
}
