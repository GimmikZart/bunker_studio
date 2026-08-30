import {
  SupabaseAgentRepository,
  SupabaseTenancyRepository,
  type SupabaseDataClient,
  type TenantStore,
} from '@bunker-studio/db';
import { createRequestSupabaseClient } from './_supabase';
import {
  SupabaseOperationalRepository,
  type ActivityRecord,
  type ProviderRecord,
} from './_supabase-operations';
import {
  addCost,
  addMemory,
  addNotification,
  addReview,
  addVerificationRun,
  createApproval,
  createMeeting,
  deleteMemory,
  getMeeting,
  getMemories,
  getRepository,
  listDesignVersions,
  listApprovals,
  listCosts,
  listMeetings,
  listNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
  importConversation,
  listConversations,
  listReviews,
  listVerificationRuns,
  recordConversation,
  markNotificationRead,
  savePushSubscription,
  saveRepository,
  replaceDesignVersions,
  resolveApproval,
  tenantStore,
  updateMeeting,
  workerRegistry,
  createTask,
  listTasks,
  updateTask,
  submitDesignVersion,
  type ApprovalRecord,
  type CostRecord,
  type MeetingRecord,
  type NotificationRecord,
  type NotificationPreferences,
  type ConversationRecord,
  type ReviewRecord,
  type VerificationRunRecord,
  type PushSubscriptionRecord,
  type RepositoryRecord,
  type TaskRecord,
} from './_store';
import type { MemoryUnit, RegisteredWorker } from '@bunker-studio/db';
import { approveDesignVersion as applyDesignApproval } from '@bunker-studio/core';
import type { DesignRecord } from '@bunker-studio/core';
import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';
import { canTransition, type TaskState } from '@bunker-studio/orchestration';

export type WebTenancyRepository = TenantStore | SupabaseTenancyRepository;

export async function getWebTenancyRepository(): Promise<WebTenancyRepository | null> {
  if (process.env.NODE_ENV !== 'production') return tenantStore;
  const client = await createRequestSupabaseClient();
  return client ? new SupabaseTenancyRepository(client as unknown as SupabaseDataClient) : null;
}

export type WebAgentRepository = TenantStore | SupabaseAgentRepository;

export async function getWebAgentRepository(): Promise<WebAgentRepository | null> {
  if (process.env.NODE_ENV !== 'production') return tenantStore;
  const client = await createRequestSupabaseClient();
  return client ? new SupabaseAgentRepository(client as unknown as SupabaseDataClient) : null;
}

export type WebOperationalRepository = SupabaseOperationalRepository | LocalOperationalRepository;

type LocalOperationalRepository = {
  getRole: (organizationId: string, actorUserId: string) => ReturnType<typeof tenantStore.getRole>;
  listMeetings: (organizationId: string, actorUserId: string) => MeetingRecord[];
  listProviders: (organizationId: string, actorUserId: string) => ProviderRecord[];
  createMeeting: (
    input: Omit<
      MeetingRecord,
      'id' | 'status' | 'contributions' | 'minutes' | 'cost' | 'createdAt'
    >,
    actorUserId: string,
  ) => MeetingRecord;
  getMeeting: (
    organizationId: string,
    meetingId: string,
    actorUserId: string,
  ) => MeetingRecord | null;
  updateMeeting: (
    organizationId: string,
    meeting: MeetingRecord,
    actorUserId: string,
  ) => MeetingRecord;
  listApprovals: (organizationId: string, actorUserId: string) => ApprovalRecord[];
  createApproval: (
    input: Omit<ApprovalRecord, 'id' | 'status' | 'createdAt'>,
    actorUserId: string,
  ) => ApprovalRecord;
  resolveApproval: (
    organizationId: string,
    approvalId: string,
    status: 'APPROVED' | 'REJECTED',
    resolvedByUserId: string,
    resolutionNote?: string,
  ) => ApprovalRecord | null;
  listCosts: (organizationId: string, actorUserId: string) => CostRecord[];
  addCost: (input: Omit<CostRecord, 'id'>, actorUserId: string) => CostRecord;
  listNotifications: (
    userId: string,
    organizationId: string,
    actorUserId: string,
  ) => NotificationRecord[];
  addNotification: (
    input: Omit<NotificationRecord, 'id' | 'readAt' | 'createdAt'>,
    actorUserId: string,
  ) => NotificationRecord;
  markNotificationRead: (userId: string, notificationId: string) => boolean;
  getNotificationPreferences: (
    organizationId: string,
    userId: string,
    actorUserId: string,
  ) => NotificationPreferences;
  saveNotificationPreferences: (
    organizationId: string,
    userId: string,
    preferences: NotificationPreferences,
    actorUserId: string,
  ) => NotificationPreferences;
  savePushSubscription: (
    userId: string,
    input: Omit<PushSubscriptionRecord, 'createdAt'>,
  ) => PushSubscriptionRecord;
  getRepository: (
    projectId: string,
    organizationId: string,
    actorUserId: string,
  ) => RepositoryRecord | null;
  saveRepository: (input: RepositoryRecord, actorUserId: string) => RepositoryRecord;
  addMemory: (
    organizationId: string,
    input: Omit<MemoryUnit, 'id' | 'deletedAt'>,
    actorUserId: string,
  ) => MemoryUnit;
  listMemories: (organizationId: string, actorUserId: string) => MemoryUnit[];
  deleteMemory: (organizationId: string, memoryId: string, actorUserId: string) => boolean;
  listDesignVersions: (organizationId: string, actorUserId: string) => DesignRecord[];
  submitDesignVersion: (
    organizationId: string,
    input: Pick<DesignRecord, 'version' | 'spec'> & {
      rationale?: string;
      previewArtifactIds?: string[];
    },
    actorUserId: string,
  ) => DesignRecord;
  approveDesignVersion: (
    organizationId: string,
    versionId: string,
    actorUserId: string,
  ) => DesignRecord[];
  registerWorker: (input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    capabilities: string[];
    allowedScopes?: string[];
    maxConcurrent?: number;
  }) => RegisteredWorker;
  getWorker: (
    nodeId: string,
    organizationId: string,
    actorUserId: string,
  ) => RegisteredWorker | null;
  heartbeatWorker: (
    nodeId: string,
    organizationId: string,
    actorUserId: string,
  ) => RegisteredWorker;
  recordChat: (
    input: {
      organizationId: string;
      agentId: string;
      externalSessionId: string;
      userContent: string;
      assistantContent: string;
      provider: string;
    },
    actorUserId: string,
  ) => void;
  listConversations: (organizationId: string, actorUserId: string) => ConversationRecord[];
  importConversation: (
    input: Omit<ConversationRecord, 'id'>,
    actorUserId: string,
  ) => ConversationRecord;
  listVerificationRuns: (
    organizationId: string,
    actorUserId: string,
    taskId?: string,
  ) => VerificationRunRecord[];
  addVerificationRun: (
    input: Omit<VerificationRunRecord, 'id' | 'executedAt'>,
    actorUserId: string,
  ) => VerificationRunRecord;
  listReviews: (organizationId: string, actorUserId: string, taskId?: string) => ReviewRecord[];
  addReview: (
    input: Omit<ReviewRecord, 'id' | 'createdAt' | 'completedAt'>,
    actorUserId: string,
  ) => ReviewRecord;
  listActivity: (organizationId: string, actorUserId: string) => ActivityRecord[];
  listWorkers: (organizationId: string, actorUserId: string) => RegisteredWorker[];
  listTasks: (organizationId: string, actorUserId: string) => TaskRecord[];
  createTask: (
    input: Omit<TaskRecord, 'id' | 'state' | 'createdAt'>,
    actorUserId: string,
  ) => TaskRecord;
  transitionTask: (
    taskId: string,
    organizationId: string,
    state: TaskState,
    actorUserId: string,
  ) => TaskRecord;
};

const localOperationalRepository: LocalOperationalRepository = {
  getRole: (organizationId, actorUserId) => tenantStore.getRole(organizationId, actorUserId),
  listMeetings: (organizationId) => listMeetings(organizationId),
  listProviders: () => [
    {
      id: 'local-fake-provider',
      providerType: 'fake',
      displayName: 'Local fake provider',
      status: 'READY',
      capabilities: ['chat', 'structured-output'],
      models: ['fake-default'],
      lastVerifiedAt: undefined,
    },
  ],
  createMeeting: (input) => createMeeting(input),
  getMeeting: (organizationId, meetingId) => getMeeting(organizationId, meetingId),
  updateMeeting: (organizationId, meeting) => updateMeeting(organizationId, meeting),
  listApprovals: (organizationId) => listApprovals(organizationId),
  createApproval: (input) => createApproval(input),
  resolveApproval: (organizationId, approvalId, status, resolvedByUserId, resolutionNote) =>
    resolveApproval(organizationId, approvalId, status, resolvedByUserId, resolutionNote),
  listCosts: (organizationId) => listCosts(organizationId),
  addCost: (input) => addCost(input),
  listNotifications: (userId, organizationId) => listNotifications(userId, organizationId),
  addNotification: (input) => addNotification(input),
  markNotificationRead: (userId, notificationId) => markNotificationRead(userId, notificationId),
  getNotificationPreferences: (organizationId, userId) =>
    getNotificationPreferences(organizationId, userId),
  saveNotificationPreferences: (organizationId, userId, preferences) =>
    saveNotificationPreferences(organizationId, userId, preferences),
  savePushSubscription: (userId, input) => savePushSubscription(userId, input),
  getRepository: (projectId) => getRepository(projectId),
  saveRepository: (input) => saveRepository(input),
  addMemory: (organizationId, input) => addMemory(organizationId, input),
  listMemories: (organizationId) => getMemories(organizationId),
  deleteMemory: (organizationId, memoryId) => deleteMemory(organizationId, memoryId),
  listDesignVersions: (organizationId) => listDesignVersions(organizationId),
  submitDesignVersion: (organizationId, input) =>
    submitDesignVersion(organizationId, { version: input.version, spec: input.spec }),
  approveDesignVersion: (organizationId, versionId, actorUserId) => {
    const versions = listDesignVersions(organizationId);
    const approved = applyDesignApproval(versions, versionId, actorUserId);
    replaceDesignVersions(organizationId, approved);
    return approved;
  },
  registerWorker: ({ organizationId, name, capabilities, allowedScopes, maxConcurrent }) =>
    workerRegistry.register({ organizationId, name, capabilities, allowedScopes, maxConcurrent }),
  getWorker: (nodeId, organizationId) => {
    const node = workerRegistry.get(nodeId);
    return node?.organizationId === organizationId ? node : null;
  },
  heartbeatWorker: (nodeId, organizationId) => {
    const node = workerRegistry.get(nodeId);
    if (!node || node.organizationId !== organizationId) throw new Error('Worker not found.');
    return workerRegistry.heartbeat(nodeId);
  },
  recordChat: (input) =>
    recordConversation({
      organizationId: input.organizationId,
      agentId: input.agentId,
      externalSessionId: input.externalSessionId,
      messages: [input.userContent, input.assistantContent],
    }),
  listConversations: (organizationId) => listConversations(organizationId),
  importConversation: (input) => importConversation(input),
  listVerificationRuns: (organizationId, _actorUserId, taskId) =>
    listVerificationRuns(organizationId, taskId),
  addVerificationRun: (input) => addVerificationRun(input),
  listReviews: (organizationId, _actorUserId, taskId) => listReviews(organizationId, taskId),
  addReview: (input) => addReview(input),
  listActivity: () => [],
  listWorkers: (organizationId) => workerRegistry.list(organizationId),
  listTasks: (organizationId) => listTasks(organizationId),
  createTask: (input) => createTask(input),
  transitionTask: (taskId, organizationId, state) => {
    const task = listTasks(organizationId).find((item) => item.id === taskId);
    if (!task) throw new Error('Task not found.');
    if (!canTransition(task.state as TaskState, state)) throw new Error('Invalid task transition.');
    return updateTask(organizationId, { ...task, state });
  },
};

export async function getWebOperationalRepository(): Promise<WebOperationalRepository | null> {
  if (process.env.NODE_ENV !== 'production') return localOperationalRepository;
  const client = await createRequestSupabaseClient();
  return client ? new SupabaseOperationalRepository(client as unknown as SupabaseDataClient) : null;
}

export function getWebAgentRuntime(providerBindingId?: string): AgentRuntime | null {
  if (process.env.NODE_ENV !== 'production') return new FakeRuntime({});
  const endpoint = process.env.AGENT_PROVIDER_ENDPOINT;
  if (!endpoint) return null;
  return new HttpAgentRuntime({
    provider: process.env.AGENT_PROVIDER_TYPE ?? 'openai-compatible',
    endpoint,
    apiKey: process.env.AGENT_PROVIDER_API_KEY,
    model: process.env.AGENT_PROVIDER_MODEL || providerBindingId,
  });
}
