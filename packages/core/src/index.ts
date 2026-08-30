export const PACKAGE_NAME = '@bunker-studio/core';

export type AutonomyMode = 'MANUAL' | 'SUPERVISED' | 'AUTONOMOUS' | 'LAB';

export type ServiceHealth = { service: string; status: 'ok'; timestamp: string };

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELED';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  defaultAutonomyMode: AutonomyMode;
  archivedAt: string | null;
  createdAt: string;
};

export type OrganizationMember = {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
};

export type Team = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  archivedAt: string | null;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  autonomyMode: AutonomyMode;
  status: ProjectStatus;
  isStudioCore: boolean;
  defaultTeamId: string | null;
  teamIds: string[];
  defaultBranch: string;
  archivedAt: string | null;
  createdAt: string;
};

export type AgentPresence =
  | 'IDLE'
  | 'PLANNING'
  | 'DESIGNING'
  | 'CODING'
  | 'TESTING'
  | 'REVIEWING'
  | 'MEETING'
  | 'WAITING_APPROVAL'
  | 'WAITING_QUOTA'
  | 'BLOCKED'
  | 'OFFLINE';
export type AgentCapabilities = {
  skills: string[];
  tools: string[];
  permissions: string[];
};
export type Agent = {
  id: string;
  organizationId: string;
  name: string;
  roleKey: string;
  title: string;
  personality: Readonly<Record<string, unknown>>;
  avatarAssetId: string | null;
  skills: string[];
  tools: string[];
  permissions: string[];
  providerBindingId: string;
  archivedAt: string | null;
};

export function derivePresence(input: {
  online: boolean;
  taskState?:
    | 'PLANNING'
    | 'DESIGNING'
    | 'CODING'
    | 'TESTING'
    | 'REVIEWING'
    | 'WAITING_APPROVAL'
    | 'WAITING_PROVIDER_QUOTA'
    | 'BLOCKED'
    | null;
}): AgentPresence {
  if (!input.online) return 'OFFLINE';
  if (input.taskState === 'WAITING_PROVIDER_QUOTA') return 'WAITING_QUOTA';
  return input.taskState ?? 'IDLE';
}

export function calculateAgentMetrics(input: {
  completedTasks: number;
  reviewedTasks: number;
  passedReviews: number;
  totalCost: number;
  cycleTimesMs: number[];
}) {
  return {
    tasksCompleted: input.completedTasks,
    firstReviewPassRate: input.reviewedTasks ? input.passedReviews / input.reviewedTasks : 0,
    averageTaskCost: input.completedTasks ? input.totalCost / input.completedTasks : 0,
    medianCycleTimeMs:
      [...input.cycleTimesMs].sort((a, b) => a - b)[Math.floor(input.cycleTimesMs.length / 2)] ?? 0,
  };
}

export class AuthorizationError extends Error {
  constructor(message = 'You are not authorized to access this organization.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'organization';
}

export function canWrite(role: OrganizationRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export type ReviewFindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReviewFinding = { severity: ReviewFindingSeverity; blocking: boolean };

export function reviewBlocksCompletion(findings: ReviewFinding[]): boolean {
  return findings.some(
    (finding) => finding.blocking || finding.severity === 'CRITICAL' || finding.severity === 'HIGH',
  );
}

export function reviewOutcome(findings: ReviewFinding[]): 'PASS' | 'FIX_REQUIRED' {
  return reviewBlocksCompletion(findings) ? 'FIX_REQUIRED' : 'PASS';
}

export type ReviewCycle = {
  outcome: 'PASS' | 'FIX_REQUIRED';
  fixTaskTitles: string[];
  completionBlocked: boolean;
};

export function evaluateReviewCycle(
  findings: Array<{ title: string; severity: ReviewFindingSeverity; blocking: boolean }>,
): ReviewCycle {
  const outcome = reviewOutcome(findings);
  return {
    outcome,
    fixTaskTitles: createFixTaskTitles(findings),
    completionBlocked: outcome === 'FIX_REQUIRED',
  };
}

export function createFixTaskTitles(
  findings: Array<{ title: string; blocking: boolean }>,
): string[] {
  return findings
    .filter((finding) => finding.blocking)
    .map((finding) => `Fix review finding: ${finding.title}`);
}

export function requiresDesignApproval(
  isMajorChange: boolean,
  approvedDesignVersionId?: string | null,
): boolean {
  return isMajorChange && !approvedDesignVersionId;
}

export function protectedProjectPolicy(input: {
  isStudioCore: boolean;
  requestedAction: 'MERGE' | 'DEPLOY' | 'EDIT_POLICY' | 'RUN';
}): { allowed: boolean; approvalRequired: boolean } {
  if (!input.isStudioCore) return { allowed: true, approvalRequired: false };
  if (input.requestedAction === 'DEPLOY' || input.requestedAction === 'EDIT_POLICY')
    return { allowed: false, approvalRequired: true };
  return { allowed: true, approvalRequired: true };
}

export type CostEntry = { amount: number; occurredAt: string; provider: string; model: string };

export function forecastMonthlyCost(entries: CostEntry[], now = new Date()): number {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const spent = entries
    .filter((entry) => {
      const time = Date.parse(entry.occurredAt);
      return time >= monthStart.getTime() && time < nextMonth.getTime();
    })
    .reduce((total, entry) => total + entry.amount, 0);
  const elapsedDays = Math.max(1, now.getUTCDate());
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return Number(((spent / elapsedDays) * daysInMonth).toFixed(6));
}

export type BudgetDecision = 'ALLOW' | 'WAITING_BUDGET_APPROVAL' | 'HARD_STOP';

export function budgetDecision(
  estimatedMinimumCost: number,
  remainingHardBudget: number,
  approvalGranted = false,
): BudgetDecision {
  if (estimatedMinimumCost <= remainingHardBudget) return 'ALLOW';
  return approvalGranted ? 'ALLOW' : 'WAITING_BUDGET_APPROVAL';
}

export function weeklyCostReport(
  entries: CostEntry[],
  now = new Date(),
): {
  periodStart: string;
  periodEnd: string;
  total: number;
  byProvider: Record<string, number>;
} {
  const end = now.getTime();
  const start = end - 7 * 24 * 60 * 60 * 1_000;
  const inPeriod = entries.filter((entry) => {
    const timestamp = Date.parse(entry.occurredAt);
    return timestamp >= start && timestamp <= end;
  });
  const byProvider = inPeriod.reduce<Record<string, number>>((result, entry) => {
    result[entry.provider] = (result[entry.provider] ?? 0) + entry.amount;
    return result;
  }, {});
  return {
    periodStart: new Date(start).toISOString(),
    periodEnd: now.toISOString(),
    total: inPeriod.reduce((total, entry) => total + entry.amount, 0),
    byProvider,
  };
}

export type StaffingProposal = {
  roleKey: string;
  title: string;
  modelTier: 'ECONOMY_WORKER' | 'BALANCED_REVIEWER' | 'PREMIUM_REASONER';
  skills: string[];
  tools: string[];
  estimatedCost: number;
  rationale: string;
};

export function suggestStaffingTeam(input: {
  requiredRoles?: string[];
  capabilities?: string[];
  budget?: number;
}): StaffingProposal[] {
  const requested = new Set(input.requiredRoles ?? ['lead', 'frontend', 'backend', 'reviewer']);
  const capabilities = input.capabilities ?? [];
  const proposals = roleTemplates
    .filter((role) => requested.has(role.roleKey))
    .map((role) => ({
      roleKey: role.roleKey,
      title: role.title,
      modelTier: role.modelTier,
      skills: capabilities.length ? [...capabilities] : [`${role.roleKey} delivery`],
      tools: role.roleKey === 'reviewer' ? ['CI', 'security scanner'] : ['repository workspace'],
      estimatedCost:
        role.modelTier === 'PREMIUM_REASONER' ? 8 : role.modelTier === 'BALANCED_REVIEWER' ? 4 : 2,
      rationale: `Role ${role.title} matches the requested delivery scope.`,
    }));
  if (input.budget === undefined) return proposals;
  return proposals.reduce<StaffingProposal[]>((selected, proposal) => {
    const spent = selected.reduce((total, item) => total + item.estimatedCost, 0);
    return spent + proposal.estimatedCost <= input.budget! ? [...selected, proposal] : selected;
  }, []);
}

export type DesignStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
export type DesignRecord = {
  id: string;
  version: number;
  status: DesignStatus;
  spec: Readonly<Record<string, unknown>>;
  approvedAt?: string;
  approvedBy?: string;
};

export function approveDesignVersion(
  versions: DesignRecord[],
  id: string,
  ownerUserId: string,
): DesignRecord[] {
  const target = versions.find((version) => version.id === id && version.status === 'SUBMITTED');
  if (!target) throw new Error('Only a submitted design version can be approved.');
  return versions.map((version) =>
    version.id === id
      ? {
          ...version,
          status: 'APPROVED',
          approvedAt: new Date().toISOString(),
          approvedBy: ownerUserId,
        }
      : version.status === 'APPROVED'
        ? { ...version, status: 'SUPERSEDED' }
        : version,
  );
}

export function confirmStaffingProposal(
  confirmed: boolean,
  proposalCount: number,
): { persistAgents: boolean; count: number } {
  return { persistAgents: confirmed, count: confirmed ? proposalCount : 0 };
}

export const roleTemplates = [
  {
    roleKey: 'lead',
    title: 'Lead Architect / Orchestrator',
    modelTier: 'PREMIUM_REASONER' as const,
  },
  { roleKey: 'frontend', title: 'Frontend Engineer', modelTier: 'ECONOMY_WORKER' as const },
  { roleKey: 'backend', title: 'Backend Engineer', modelTier: 'ECONOMY_WORKER' as const },
  {
    roleKey: 'reviewer',
    title: 'Reviewer / QA / Security',
    modelTier: 'BALANCED_REVIEWER' as const,
  },
  { roleKey: 'designer', title: 'Product Designer', modelTier: 'BALANCED_REVIEWER' as const },
  { roleKey: 'hr', title: 'HR / Staffing', modelTier: 'ECONOMY_WORKER' as const },
] as const;
