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
export type AgentReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
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
  providerConnectionId: string;
  providerType: string;
  providerModelId: string;
  runtimeType: string;
  reasoningEffort: AgentReasoningEffort;
  archivedAt: string | null;
};

export type AgentAssignment = {
  id: string;
  organizationId: string;
  agentId: string;
  teamId: string | null;
  projectId: string | null;
  reportsToAgentId: string | null;
  active: boolean;
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

export function protectedMergeGate(input: {
  isStudioCore: boolean;
  reviewerPassed: boolean;
  ciPassed: boolean;
  ownerApproved: boolean;
  actorIsAgent: boolean;
}): { allowed: boolean; missing: string[]; productionDeployAllowed: false } {
  if (!input.isStudioCore) return { allowed: true, missing: [], productionDeployAllowed: false };
  const missing = [
    ...(!input.reviewerPassed ? ['REVIEWER'] : []),
    ...(!input.ciPassed ? ['CI'] : []),
    ...(!input.ownerApproved ? ['OWNER_APPROVAL'] : []),
    ...(input.actorIsAgent ? ['HUMAN_ACTOR'] : []),
  ];
  return { allowed: missing.length === 0, missing, productionDeployAllowed: false };
}

export type CostEntry = {
  amount: number;
  occurredAt: string;
  provider: string;
  model: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  projectId?: string;
  taskId?: string;
  agentId?: string;
  runId?: string;
};

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

export type WeeklyCostReport = {
  periodStart: string;
  periodEnd: string;
  total: number;
  byProvider: Record<string, number>;
};

export function weeklyCostReport(entries: CostEntry[], now = new Date()): WeeklyCostReport {
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

export function nextWeeklyReportAt(
  schedule: { dayOfWeek: number; hourUtc: number; minuteUtc: number },
  now = new Date(),
): Date {
  const dayOfWeek = Math.min(6, Math.max(0, Math.trunc(schedule.dayOfWeek)));
  const hourUtc = Math.min(23, Math.max(0, Math.trunc(schedule.hourUtc)));
  const minuteUtc = Math.min(59, Math.max(0, Math.trunc(schedule.minuteUtc)));
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, minuteUtc, 0, 0),
  );
  let daysUntil = (dayOfWeek - now.getUTCDay() + 7) % 7;
  if (daysUntil === 0 && candidate.getTime() <= now.getTime()) daysUntil = 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntil);
  return candidate;
}

export type BudgetPeriodType = 'PER_RUN' | 'PER_TASK' | 'DAILY' | 'MONTHLY';
export type BudgetSoftAction = 'ALLOW' | 'NOTIFY' | 'REQUIRE_APPROVAL';
export type BudgetHardAction = 'BLOCK' | 'REQUIRE_APPROVAL';
export type BudgetPolicy = {
  id: string;
  projectId?: string | null;
  agentId?: string | null;
  periodType: BudgetPeriodType;
  softLimit: number;
  hardLimit: number;
  currency: string;
  actionOnSoft: BudgetSoftAction;
  actionOnHard: BudgetHardAction;
  escalationThreshold: number;
  allowProviderFallback: boolean;
  enabled: boolean;
};

export type BudgetEvaluation = {
  decision: BudgetDecision;
  usageByPolicy: Record<string, number>;
  matchedPolicyIds: string[];
  softLimitExceeded: string[];
  hardLimitExceeded: string[];
  fallbackAllowed: boolean;
};

function policyMatches(
  policy: Pick<BudgetPolicy, 'projectId' | 'agentId'>,
  context: { projectId?: string; agentId?: string },
): boolean {
  return (
    (policy.projectId == null || policy.projectId === context.projectId) &&
    (policy.agentId == null || policy.agentId === context.agentId)
  );
}

function periodStart(periodType: BudgetPeriodType, now: Date): number | null {
  if (periodType === 'PER_RUN' || periodType === 'PER_TASK') return null;
  if (periodType === 'DAILY')
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

function entryBelongsToPolicy(
  entry: CostEntry,
  policy: BudgetPolicy,
  context: { projectId?: string; taskId?: string; agentId?: string; runId?: string },
  now: Date,
): boolean {
  if (policy.projectId != null && entry.projectId !== policy.projectId) return false;
  if (policy.agentId != null && entry.agentId !== policy.agentId) return false;
  if (policy.periodType === 'PER_RUN' && entry.runId !== context.runId) return false;
  if (policy.periodType === 'PER_TASK' && entry.taskId !== context.taskId) return false;
  const start = periodStart(policy.periodType, now);
  return start === null || Date.parse(entry.occurredAt) >= start;
}

export function evaluateBudgetPolicies(input: {
  policies: BudgetPolicy[];
  entries: CostEntry[];
  estimatedCost: number;
  context: { projectId?: string; taskId?: string; agentId?: string; runId?: string };
  now?: Date;
  approvalGranted?: boolean;
}): BudgetEvaluation {
  const now = input.now ?? new Date();
  const usageByPolicy: Record<string, number> = {};
  const matchedPolicyIds: string[] = [];
  const softLimitExceeded: string[] = [];
  const hardLimitExceeded: string[] = [];
  let waitingForApproval = false;
  let fallbackAllowed = false;

  for (const policy of input.policies) {
    if (!policy.enabled || !policyMatches(policy, input.context)) continue;
    matchedPolicyIds.push(policy.id);
    const usage = input.entries
      .filter((entry) => entryBelongsToPolicy(entry, policy, input.context, now))
      .reduce((total, entry) => total + entry.amount, 0);
    const projected = usage + input.estimatedCost;
    usageByPolicy[policy.id] = usage;
    fallbackAllowed ||= policy.allowProviderFallback;
    if (policy.hardLimit > 0 && projected > policy.hardLimit) {
      hardLimitExceeded.push(policy.id);
      if (policy.actionOnHard === 'REQUIRE_APPROVAL' && !input.approvalGranted)
        waitingForApproval = true;
      else if (policy.actionOnHard === 'BLOCK') waitingForApproval = false;
    } else if (policy.softLimit > 0 && projected > policy.softLimit) {
      softLimitExceeded.push(policy.id);
      if (policy.actionOnSoft === 'REQUIRE_APPROVAL' && !input.approvalGranted)
        waitingForApproval = true;
    }
  }

  const hardBlocked = hardLimitExceeded.some((id) => {
    const policy = input.policies.find((candidate) => candidate.id === id);
    return policy?.actionOnHard === 'BLOCK';
  });
  return {
    decision: hardBlocked ? 'HARD_STOP' : waitingForApproval ? 'WAITING_BUDGET_APPROVAL' : 'ALLOW',
    usageByPolicy,
    matchedPolicyIds,
    softLimitExceeded,
    hardLimitExceeded,
    fallbackAllowed,
  };
}

/**
 * Headroom left under the tightest matching hard limit, or `null` when no hard
 * cap applies.  Planning uses this to size a proposal before any provider call,
 * so an over-budget plan is rejected without spending anything to find out.
 */
export function remainingHardBudget(input: {
  policies: BudgetPolicy[];
  entries: CostEntry[];
  context: { projectId?: string; taskId?: string; agentId?: string; runId?: string };
  now?: Date;
}): number | null {
  const now = input.now ?? new Date();
  let remaining: number | null = null;
  for (const policy of input.policies) {
    if (!policy.enabled || !policyMatches(policy, input.context)) continue;
    if (policy.hardLimit <= 0) continue;
    const usage = input.entries
      .filter((entry) => entryBelongsToPolicy(entry, policy, input.context, now))
      .reduce((total, entry) => total + entry.amount, 0);
    const headroom = Math.max(0, policy.hardLimit - usage);
    remaining = remaining === null ? headroom : Math.min(remaining, headroom);
  }
  return remaining;
}

export type EscalationReason =
  | 'FAILED_IMPLEMENTATION_ATTEMPTS'
  | 'REPEATED_TEST_FAILURE'
  | 'ARCHITECTURAL_REVIEW'
  | 'CONFLICTING_PROPOSALS';

export type EscalationDecision = {
  escalate: boolean;
  reasons: EscalationReason[];
};

export function evaluateEscalation(input: {
  failedImplementationAttempts?: number;
  repeatedTestFailures?: number;
  reviewerRequiresArchitecture?: boolean;
  conflictingProposals?: boolean;
  threshold?: number;
}): EscalationDecision {
  const threshold = Math.max(2, input.threshold ?? 2);
  const reasons: EscalationReason[] = [];
  if ((input.failedImplementationAttempts ?? 0) >= threshold)
    reasons.push('FAILED_IMPLEMENTATION_ATTEMPTS');
  if ((input.repeatedTestFailures ?? 0) >= threshold) reasons.push('REPEATED_TEST_FAILURE');
  if (input.reviewerRequiresArchitecture) reasons.push('ARCHITECTURAL_REVIEW');
  if (input.conflictingProposals) reasons.push('CONFLICTING_PROPOSALS');
  return { escalate: reasons.length > 0, reasons };
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
  goal?: string;
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
      rationale: `${role.title} matches the requested delivery scope${input.goal ? `: ${input.goal}` : ''}.`,
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
  /** The immutable request this proposal belongs to, when it was created by Designer. */
  designRequestId?: string;
  rationale?: string;
  previewArtifactIds?: readonly string[];
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

export type DesignResolution = 'APPROVED' | 'REJECTED' | 'CHANGES';

export function resolveDesignVersion(
  versions: DesignRecord[],
  id: string,
  resolution: DesignResolution,
  ownerUserId: string,
): DesignRecord[] {
  const target = versions.find((version) => version.id === id && version.status === 'SUBMITTED');
  if (!target) throw new Error('Only a submitted design version can be resolved.');
  if (resolution === 'APPROVED') return approveDesignVersion(versions, id, ownerUserId);
  return versions.map((version) =>
    version.id === id
      ? { ...version, status: resolution === 'CHANGES' ? 'DRAFT' : 'REJECTED' }
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
