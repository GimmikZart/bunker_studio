import {
  SupabaseAgentRepository,
  SupabaseTenancyRepository,
  decryptSecret,
  type EncryptedSecret,
  type SupabaseDataClient,
  type TenantStore,
} from '@bunker-studio/db';
import { createRequestSupabaseClient, createWorkerServiceSupabaseClient } from './_supabase';
import { SupabaseOperationalRepository, type ProviderRecord } from './_supabase-operations';
import {
  addCost,
  addActivity,
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
  listRepositories,
  listGitHubConnections,
  getGitHubConnection,
  saveGitHubConnection,
  deleteGitHubConnection,
  startAgentRun,
  finishAgentRun,
  listDesignVersions,
  listDesignPreviews,
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
  listActivity,
  listBudgetPolicies,
  createBudgetPolicy,
  updateBudgetPolicy,
  deleteBudgetPolicy,
  getReportSchedule,
  saveReportSchedule,
  listBudgetReports,
  listProviderConnections,
  getProviderConnection,
  type BudgetReportRecord,
  createWorkflow,
  listWorkflows,
  updateWorkflowTasks,
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
  type GitHubConnectionSummary,
  type GitHubConnectionRecord,
  type AgentRunRecord,
  type TaskRecord,
  type TaskCreateRecord,
  type ActivityRecord,
  type DesignPreviewArtifact,
  type WorkflowRecord,
  type BudgetPolicyRecord,
  type ReportScheduleRecord,
} from './_store';
import type { MemoryUnit, RegisteredWorker } from '@bunker-studio/db';
import type { LeadPlan } from '@bunker-studio/contracts';
import {
  approveDesignVersion as applyDesignApproval,
  resolveDesignVersion as applyDesignResolution,
} from '@bunker-studio/core';
import type { Agent, BudgetPolicy, DesignRecord } from '@bunker-studio/core';
import { FakeRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';
import { createAnthropicRuntime } from '@bunker-studio/provider-anthropic';
import { createOpenAIRuntime } from '@bunker-studio/provider-openai';
import { createCompatibleRuntime } from '@bunker-studio/provider-openai-compatible';
import { canTransition, type TaskState } from '@bunker-studio/orchestration';
import { usesSupabasePersistence } from './_persistence';

export type WebTenancyRepository = TenantStore | SupabaseTenancyRepository;

export async function getWebTenancyRepository(): Promise<WebTenancyRepository | null> {
  if (!usesSupabasePersistence()) return tenantStore;
  const client = await createRequestSupabaseClient();
  return client ? new SupabaseTenancyRepository(client as unknown as SupabaseDataClient) : null;
}

export type WebAgentRepository = TenantStore | SupabaseAgentRepository;

export async function getWebAgentRepository(): Promise<WebAgentRepository | null> {
  if (!usesSupabasePersistence()) return tenantStore;
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
  listBudgetPolicies: (organizationId: string, actorUserId: string) => BudgetPolicyRecord[];
  createBudgetPolicy: (
    organizationId: string,
    input: Omit<BudgetPolicy, 'id'>,
    actorUserId: string,
  ) => BudgetPolicyRecord;
  updateBudgetPolicy: (
    organizationId: string,
    policyId: string,
    patch: Partial<Omit<BudgetPolicy, 'id'>>,
    actorUserId: string,
  ) => BudgetPolicyRecord | null;
  deleteBudgetPolicy: (organizationId: string, policyId: string, actorUserId: string) => boolean;
  getReportSchedule: (organizationId: string, actorUserId: string) => ReportScheduleRecord | null;
  saveReportSchedule: (
    organizationId: string,
    input: Omit<
      ReportScheduleRecord,
      'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'lastRunAt'
    > & { lastRunAt?: string | null },
    actorUserId: string,
  ) => ReportScheduleRecord;
  listBudgetReports: (organizationId: string, actorUserId: string) => BudgetReportRecord[];
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
  saveRepository: (
    input: RepositoryRecord,
    actorUserId: string,
    encryptedCredential?: Record<string, unknown>,
  ) => RepositoryRecord;
  listRepositories: (organizationId: string, actorUserId: string) => RepositoryRecord[];
  listGitHubConnections: (organizationId: string, actorUserId: string) => GitHubConnectionSummary[];
  getGitHubConnectionSecret: (
    organizationId: string,
    connectionId: string,
    actorUserId: string,
  ) => { connection: GitHubConnectionSummary; encryptedSecret: Record<string, unknown> } | null;
  saveGitHubConnection: (
    input: {
      organizationId: string;
      accountLogin: string;
      accountType: 'USER' | 'ORGANIZATION';
      encryptedSecret: Record<string, unknown>;
    },
    actorUserId: string,
  ) => GitHubConnectionSummary;
  deleteGitHubConnection: (
    organizationId: string,
    connectionId: string,
    actorUserId: string,
  ) => boolean;
  startAgentRun: (
    input: {
      organizationId: string;
      agentId: string;
      correlationId: string;
      meetingId?: string;
    },
    actorUserId: string,
  ) => AgentRunRecord;
  finishAgentRun: (
    organizationId: string,
    runId: string,
    state: 'COMPLETED' | 'FAILED',
    externalRunId: string | undefined,
    actorUserId: string,
  ) => AgentRunRecord | null;
  addMemory: (
    organizationId: string,
    input: Omit<MemoryUnit, 'id' | 'deletedAt'>,
    actorUserId: string,
  ) => MemoryUnit;
  listMemories: (organizationId: string, actorUserId: string) => MemoryUnit[];
  deleteMemory: (organizationId: string, memoryId: string, actorUserId: string) => boolean;
  listDesignVersions: (organizationId: string, actorUserId: string) => DesignRecord[];
  listDesignPreviews: (
    organizationId: string,
    versionId: string,
    actorUserId: string,
  ) => DesignPreviewArtifact[];
  submitDesignVersion: (
    organizationId: string,
    input: Pick<DesignRecord, 'version' | 'spec'> & {
      rationale?: string;
      previewArtifactIds?: string[];
      designRequestId?: string;
      designRequest?: {
        designerAgentId: string;
        brief: string;
        projectId?: string;
        taskId?: string;
      };
      previews?: Omit<DesignPreviewArtifact, 'id'>[];
    },
    actorUserId: string,
  ) => DesignRecord;
  approveDesignVersion: (
    organizationId: string,
    versionId: string,
    actorUserId: string,
  ) => DesignRecord[];
  resolveDesignVersion: (
    organizationId: string,
    versionId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CHANGES',
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
  revokeWorker: (
    nodeId: string,
    organizationId: string,
    actorUserId: string,
  ) => RegisteredWorker | null;
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
  recordActivity: (input: {
    organizationId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
  listWorkflows: (organizationId: string, actorUserId: string) => WorkflowRecord[];
  createWorkflow: (
    input: {
      organizationId: string;
      projectId: string;
      plan: Pick<LeadPlan, 'goal' | 'assumptions' | 'verificationSteps'>;
      createdByUserId: string;
    },
    actorUserId: string,
  ) => WorkflowRecord;
  updateWorkflowTasks: (
    organizationId: string,
    workflowId: string,
    taskIds: string[],
    rootTaskId: string | null,
    actorUserId: string,
  ) => WorkflowRecord;
  listWorkers: (organizationId: string, actorUserId: string) => RegisteredWorker[];
  listTasks: (organizationId: string, actorUserId: string) => TaskRecord[];
  createTask: (input: TaskCreateRecord, actorUserId: string) => TaskRecord;
  transitionTask: (
    taskId: string,
    organizationId: string,
    state: TaskState,
    actorUserId: string,
  ) => TaskRecord;
};

/** The stored token stays server-side: only these fields reach a response. */
function githubConnectionSummary(connection: GitHubConnectionRecord): GitHubConnectionSummary {
  return {
    id: connection.id,
    organizationId: connection.organizationId,
    accountLogin: connection.accountLogin,
    accountType: connection.accountType,
    status: connection.status,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

const localOperationalRepository: LocalOperationalRepository = {
  getRole: (organizationId, actorUserId) => tenantStore.getRole(organizationId, actorUserId),
  listMeetings: (organizationId) => listMeetings(organizationId),
  listProviders: (organizationId) => [
    {
      id: '00000000-0000-4000-8000-000000000001',
      providerType: 'FAKE',
      displayName: 'Local fake provider',
      status: 'READY',
      capabilities: ['chat', 'structured-output'],
      models: ['fake-default'],
      lastVerifiedAt: undefined,
    },
    // Connections made during this local run. The secret is never included.
    ...listProviderConnections(organizationId).map((connection) => ({
      id: connection.id,
      providerType: connection.providerType,
      displayName: connection.displayName,
      status: connection.status,
      capabilities: connection.capabilities,
      models: connection.models,
      lastVerifiedAt: connection.createdAt,
    })),
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
  listBudgetPolicies: (organizationId) => listBudgetPolicies(organizationId),
  createBudgetPolicy: (organizationId, input) => createBudgetPolicy(organizationId, input),
  updateBudgetPolicy: (organizationId, policyId, patch) =>
    updateBudgetPolicy(organizationId, policyId, patch),
  deleteBudgetPolicy: (organizationId, policyId) => deleteBudgetPolicy(organizationId, policyId),
  getReportSchedule: (organizationId) => getReportSchedule(organizationId),
  saveReportSchedule: (organizationId, input) => saveReportSchedule(organizationId, input),
  listBudgetReports: (organizationId) => listBudgetReports(organizationId),
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
  listRepositories: (organizationId) => listRepositories(organizationId),
  listGitHubConnections: (organizationId) =>
    listGitHubConnections(organizationId).map(githubConnectionSummary),
  getGitHubConnectionSecret: (organizationId, connectionId) => {
    const connection = getGitHubConnection(organizationId, connectionId);
    if (!connection) return null;
    return {
      connection: githubConnectionSummary(connection),
      encryptedSecret: connection.encryptedSecret as unknown as Record<string, unknown>,
    };
  },
  saveGitHubConnection: (input) =>
    githubConnectionSummary(
      saveGitHubConnection({
        ...input,
        encryptedSecret: input.encryptedSecret as unknown as EncryptedSecret,
      }),
    ),
  deleteGitHubConnection: (organizationId, connectionId) =>
    deleteGitHubConnection(organizationId, connectionId),
  startAgentRun: (input) => startAgentRun(input),
  finishAgentRun: (organizationId, runId, state, externalRunId) =>
    finishAgentRun(organizationId, runId, state, externalRunId),
  addMemory: (organizationId, input) => addMemory(organizationId, input),
  listMemories: (organizationId) => getMemories(organizationId),
  deleteMemory: (organizationId, memoryId) => deleteMemory(organizationId, memoryId),
  listDesignVersions: (organizationId) => listDesignVersions(organizationId),
  listDesignPreviews: (organizationId, versionId) => listDesignPreviews(organizationId, versionId),
  submitDesignVersion: (organizationId, input) => submitDesignVersion(organizationId, input),
  approveDesignVersion: (organizationId, versionId, actorUserId) => {
    const versions = listDesignVersions(organizationId);
    const approved = applyDesignApproval(versions, versionId, actorUserId);
    replaceDesignVersions(organizationId, approved);
    return approved;
  },
  resolveDesignVersion: (organizationId, versionId, decision, actorUserId) => {
    const versions = listDesignVersions(organizationId);
    const resolved = applyDesignResolution(versions, versionId, decision, actorUserId);
    replaceDesignVersions(organizationId, resolved);
    return resolved;
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
  revokeWorker: (nodeId, organizationId) => {
    const node = workerRegistry.get(nodeId);
    if (!node || node.organizationId !== organizationId) return null;
    workerRegistry.revoke(nodeId);
    return workerRegistry.get(nodeId);
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
  listActivity: (organizationId) => listActivity(organizationId),
  recordActivity: async (input) => {
    addActivity(input);
  },
  listWorkflows: (organizationId) => listWorkflows(organizationId),
  createWorkflow: (input) => createWorkflow(input),
  updateWorkflowTasks: (organizationId, workflowId, taskIds, rootTaskId) =>
    updateWorkflowTasks(organizationId, workflowId, taskIds, rootTaskId),
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
  if (!usesSupabasePersistence()) return localOperationalRepository;
  const client = await createRequestSupabaseClient();
  return client ? new SupabaseOperationalRepository(client as unknown as SupabaseDataClient) : null;
}

/** Builds the provider adapter for a binding. Shared by both persistence modes. */
function runtimeForConnection(input: {
  providerType: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: Agent['reasoningEffort'];
}): AgentRuntime | null {
  const baseUrl = input.apiBaseUrl.replace(/\/$/, '');
  if (!baseUrl) return null;
  const options = { apiKey: input.apiKey, model: input.model };
  if (input.providerType === 'OPENAI')
    return createOpenAIRuntime({
      endpoint: `${baseUrl}/responses`,
      reasoningEffort: input.reasoningEffort,
      ...options,
    });
  if (input.providerType === 'ANTHROPIC')
    return createAnthropicRuntime({ endpoint: `${baseUrl}/messages`, ...options });
  if (input.providerType === 'OPENAI_COMPATIBLE')
    return createCompatibleRuntime({ endpoint: `${baseUrl}/chat/completions`, ...options });
  return null;
}

export async function getWebAgentRuntime(agent: Agent): Promise<AgentRuntime | null> {
  // Memory persistence is the dev/test mode. An agent bound to a provider
  // connected during this run gets the real runtime, so a local trial exercises
  // the same code path as a hosted deployment; everything else keeps the fake,
  // and the canned response lets a test drive the structured paths (plan,
  // minutes, design draft) without a provider.
  if (!usesSupabasePersistence()) {
    const masterKey = process.env.STUDIO_MASTER_KEY;
    const connection = getProviderConnection(agent.organizationId, agent.providerConnectionId);
    if (connection && masterKey)
      return runtimeForConnection({
        providerType: connection.providerType,
        apiBaseUrl: connection.apiBaseUrl,
        apiKey: decryptSecret(connection.encryptedSecret, masterKey),
        model: agent.providerModelId,
        reasoningEffort: agent.reasoningEffort,
      });
    const response = process.env.BUNKER_FAKE_RUNTIME_RESPONSE;
    return new FakeRuntime(response ? { response } : {});
  }
  const client = createWorkerServiceSupabaseClient();
  const masterKey = process.env.STUDIO_MASTER_KEY;
  if (!client || !masterKey) return null;
  const { data, error } = await client
    .from('provider_connections')
    .select('provider_type, encrypted_secret_blob, api_base_url, status')
    .eq('id', agent.providerConnectionId)
    .eq('organization_id', agent.organizationId)
    .eq('status', 'READY')
    .maybeSingle();
  if (error || !data) return null;
  const record = data as Record<string, unknown>;
  if (!record.encrypted_secret_blob || typeof record.encrypted_secret_blob !== 'object')
    return null;
  const baseUrl =
    typeof record.api_base_url === 'string' ? record.api_base_url.replace(/\/$/, '') : '';
  const providerType = typeof record.provider_type === 'string' ? record.provider_type : '';
  if (!baseUrl) return null;
  return runtimeForConnection({
    providerType,
    apiBaseUrl: baseUrl,
    apiKey: decryptSecret(record.encrypted_secret_blob as EncryptedSecret, masterKey),
    model: agent.providerModelId,
    reasoningEffort: agent.reasoningEffort,
  });
}
