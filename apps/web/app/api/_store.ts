import { TenantStore, WorkerRegistry } from '@bunker-studio/db';
import type { CostEntry, DesignRecord } from '@bunker-studio/core';
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
  pushSubscriptions: Map<string, PushSubscriptionRecord[]>;
  repositories: Map<string, RepositoryRecord>;
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
  pushSubscriptions: new Map<string, PushSubscriptionRecord[]>(),
  repositories: new Map<string, RepositoryRecord>(),
});

export const tenantStore = state.tenantStore;
export const workerRegistry = state.workerRegistry;

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

export function saveRepository(input: RepositoryRecord): RepositoryRecord {
  state.repositories.set(input.projectId, structuredClone(input));
  return structuredClone(input);
}

export function getRepository(projectId: string): RepositoryRecord | null {
  const repository = state.repositories.get(projectId);
  return repository ? structuredClone(repository) : null;
}
