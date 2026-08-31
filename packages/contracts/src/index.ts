import { z } from 'zod';

export const healthResponseSchema = z.object({
  service: z.string().min(1),
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  autonomyMode: z.enum(['MANUAL', 'SUPERVISED', 'AUTONOMOUS', 'LAB']).optional(),
});

export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;

export const reviewFindingSchema = z.object({
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category: z.enum([
    'CORRECTNESS',
    'SECURITY',
    'PERFORMANCE',
    'TEST',
    'MAINTAINABILITY',
    'SPECIFICATION',
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.string().min(1),
  filePath: z.string().optional(),
  symbol: z.string().optional(),
  recommendation: z.string().min(1),
  blocking: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;

export const leadTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  taskType: z.enum(['FRONTEND', 'BACKEND', 'DESIGN', 'TEST', 'DOCS', 'REVIEW']),
  description: z.string(),
  dependencies: z.array(z.string()),
  readScope: z.array(z.string()),
  writeScope: z.array(z.string()),
  requiredCapability: z.string().min(1).max(80).optional(),
  parallelGroupId: z.string().min(1).optional(),
  approvedDesignVersionId: z.string().uuid().optional(),
  definitionOfDone: z.array(z.string().min(1)),
  estimatedCost: z.number().nonnegative(),
});
export type LeadTask = z.infer<typeof leadTaskSchema>;

export const leadPlanSchema = z.object({
  goal: z.string().min(1),
  assumptions: z.array(z.string()),
  tasks: z.array(leadTaskSchema).min(1),
  verificationSteps: z.array(z.string().min(1)).min(1),
});
export type LeadPlan = z.infer<typeof leadPlanSchema>;

export const leadPlanSubmissionSchema = z.object({
  projectId: z.string().uuid(),
  plan: leadPlanSchema,
});
export type LeadPlanSubmission = z.infer<typeof leadPlanSubmissionSchema>;

export const verificationRunSchema = z.object({
  kind: z.enum(['FORMAT', 'LINT', 'TYPECHECK', 'UNIT', 'INTEGRATION', 'E2E', 'SECURITY', 'BUILD']),
  commandOrCheck: z.string().min(1),
  status: z.enum(['PASS', 'FAIL', 'SKIPPED']),
  artifactId: z.string().uuid().optional(),
  durationMs: z.number().int().nonnegative(),
  output: z.string().optional(),
});
export type VerificationRun = z.infer<typeof verificationRunSchema>;

export const reviewReportSchema = z.object({
  candidateSha: z.string().min(1),
  status: z.enum(['PASS', 'FIX_REQUIRED']),
  summary: z.string(),
  findings: z.array(reviewFindingSchema),
  verificationRuns: z.array(verificationRunSchema),
  failedImplementationAttempts: z.number().int().nonnegative().optional(),
  repeatedTestFailures: z.number().int().nonnegative().optional(),
  architecturalReviewRequired: z.boolean().optional(),
  conflictingProposals: z.boolean().optional(),
});
export type ReviewReport = z.infer<typeof reviewReportSchema>;

export const reviewSubmissionSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  reviewerAgentId: z.string().uuid(),
  report: reviewReportSchema,
});
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;

export const designVersionSchema = z.object({
  versionNumber: z.number().int().positive().max(3),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED']),
  spec: z.record(z.unknown()),
  rationale: z.string(),
  previewArtifactIds: z.array(z.string()),
});
export type DesignVersion = z.infer<typeof designVersionSchema>;
export const designResolutionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES']),
});
export type DesignResolutionInput = z.infer<typeof designResolutionSchema>;

export const staffingProposalSchema = z.object({
  roleKey: z.string().min(1),
  title: z.string().min(1),
  modelTier: z.enum(['ECONOMY_WORKER', 'BALANCED_REVIEWER', 'PREMIUM_REASONER']),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  estimatedCost: z.number().nonnegative(),
  rationale: z.string().min(1),
});
export type StaffingProposal = z.infer<typeof staffingProposalSchema>;

export const staffingRequestSchema = z.object({
  requiredRoles: z.array(z.string().min(1)).optional(),
  capabilities: z.array(z.string().min(1)).optional(),
  budget: z.number().nonnegative().optional(),
});
export type StaffingRequest = z.infer<typeof staffingRequestSchema>;

export const meetingMinutesSchema = z.object({
  summary: z.string(),
  decisions: z.array(z.object({ title: z.string(), decision: z.string() })),
  actionItems: z.array(z.object({ title: z.string(), ownerAgentId: z.string().optional() })),
});
export type MeetingMinutes = z.infer<typeof meetingMinutesSchema>;

export const agentCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  roleKey: z.string().min(1),
  title: z.string().min(1),
  personality: z.record(z.unknown()).default({}),
  avatarAssetId: z.string().uuid().nullable().optional(),
  skills: z.array(z.string().trim().min(1)).max(50).default([]),
  tools: z.array(z.string().trim().min(1)).max(50).default([]),
  permissions: z.array(z.string().trim().min(1)).max(50).default([]),
  providerBindingId: z.string().min(1),
});
export type AgentCreateInput = z.infer<typeof agentCreateSchema>;
export const staffingConfirmationSchema = z.object({
  confirmed: z.boolean(),
  agents: z.array(agentCreateSchema),
});
export type StaffingConfirmation = z.infer<typeof staffingConfirmationSchema>;
export const agentUpdateSchema = agentCreateSchema
  .partial()
  .extend({ name: z.string().trim().min(1).max(120).optional() });

export const agentAssignmentSchema = z
  .object({
    teamId: z.string().uuid().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    reportsToAgentId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Boolean(value.teamId || value.projectId), {
    message: 'An assignment must reference a team or project.',
  });
export type AgentAssignmentInput = z.infer<typeof agentAssignmentSchema>;

export const studioLabRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('INITIALIZE') }),
  z.object({ action: z.literal('ANALYZE') }),
  z.object({
    action: z.literal('SELECT'),
    projectId: z.string().uuid(),
    proposalId: z.string().min(1).max(80),
  }),
]);
export type StudioLabRequest = z.infer<typeof studioLabRequestSchema>;

export const studioLabMergeSchema = z.object({ taskId: z.string().uuid() });
export type StudioLabMergeInput = z.infer<typeof studioLabMergeSchema>;

export const authCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export const teamCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
export const teamUpdateSchema = teamCreateSchema.partial();
export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).optional(),
  teamId: z.string().uuid().optional(),
  teamIds: z.array(z.string().uuid()).max(20).optional(),
});
export const projectUpdateSchema = projectCreateSchema.partial();

export const memberInviteSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export const workerRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  capabilities: z.array(z.string().min(1)).max(50),
  allowedScopes: z.array(z.string()).max(100).optional(),
  maxConcurrent: z.number().int().positive().max(32).optional(),
});
export const workerHeartbeatSchema = z.object({ nodeId: z.string().uuid() });
export const workerRegistrationTokenCreateSchema = z.object({
  allowedScopes: z.array(z.string().trim().min(1)).max(100).default([]),
  maxConcurrent: z.number().int().positive().max(32).default(1),
  expiresInMinutes: z.number().int().min(5).max(1_440).default(60),
});
export const workerRuntimeRegistrationSchema = workerRegistrationSchema.extend({
  registrationToken: z.string().trim().min(32).max(256),
});
export const workerTaskCompletionSchema = z.object({
  nodeId: z.string().uuid(),
  leaseId: z.string().uuid(),
  success: z.boolean(),
  result: z.record(z.unknown()).default({}),
  error: z.string().trim().max(2_000).optional(),
});

export const memoryCreateSchema = z.object({
  content: z.string().min(1).max(20_000),
  type: z.enum(['PROJECT_KNOWLEDGE', 'DECISION', 'LESSON', 'PINNED']),
  importance: z.number().int().min(0).max(100).default(50),
  projectId: z.string().optional(),
  sourceId: z.string().optional(),
});
export const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  sessionId: z.string().optional(),
});

export const meetingCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  meetingType: z.string().trim().min(1).max(80),
  agenda: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  agentIds: z.array(z.string().uuid()).min(1).max(12),
  maxRounds: z.number().int().min(1).max(3).default(2),
});

export const approvalCreateSchema = z.object({
  approvalType: z.string().trim().min(1).max(80),
  subjectType: z.string().trim().min(1).max(80),
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  risk: z.enum(['LOW', 'HIGH', 'CRITICAL']).default('HIGH'),
});

export const approvalResolutionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  resolutionNote: z.string().trim().max(2_000).optional(),
});

export const costEntrySchema = z.object({
  amount: z.number().nonnegative(),
  occurredAt: z.string().datetime().optional(),
  provider: z.string().min(1).max(80),
  model: z.string().min(1).max(160),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  agentId: z.string().optional(),
  runId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
});

const budgetPolicyBaseSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  agentId: z.string().uuid().nullable().optional(),
  periodType: z.enum(['PER_RUN', 'PER_TASK', 'DAILY', 'MONTHLY']),
  softLimit: z.number().nonnegative().max(1_000_000_000),
  hardLimit: z.number().nonnegative().max(1_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  actionOnSoft: z.enum(['ALLOW', 'NOTIFY', 'REQUIRE_APPROVAL']),
  actionOnHard: z.enum(['BLOCK', 'REQUIRE_APPROVAL']),
  escalationThreshold: z.number().int().min(0).max(100),
  allowProviderFallback: z.boolean(),
  enabled: z.boolean(),
});
export const budgetPolicySchema = budgetPolicyBaseSchema.refine(
  (value) => value.hardLimit === 0 || value.softLimit === 0 || value.softLimit <= value.hardLimit,
  {
    message: 'Soft limit cannot exceed hard limit.',
    path: ['softLimit'],
  },
);
export type BudgetPolicyInput = z.infer<typeof budgetPolicySchema>;
export const budgetPolicyUpdateSchema = budgetPolicyBaseSchema.partial();
export type BudgetPolicyUpdateInput = z.infer<typeof budgetPolicyUpdateSchema>;

export const reportScheduleSchema = z.object({
  frequency: z.literal('WEEKLY'),
  dayOfWeek: z.number().int().min(0).max(6),
  hourUtc: z.number().int().min(0).max(23),
  minuteUtc: z.number().int().min(0).max(59),
  timezone: z.string().trim().min(1).max(64),
  recipients: z.array(z.string().min(1).max(320)).max(20),
  enabled: z.boolean(),
});
export type ReportScheduleInput = z.infer<typeof reportScheduleSchema>;
export const reportScheduleUpdateSchema = reportScheduleSchema.partial();
export type ReportScheduleUpdateInput = z.infer<typeof reportScheduleUpdateSchema>;

export const notificationCreateSchema = z.object({
  userId: z.string().min(1),
  category: z.enum(['APPROVAL', 'SECURITY', 'BUDGET', 'QUOTA', 'WORKFLOW']),
  severity: z.enum(['LOW', 'HIGH', 'CRITICAL']),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2_000),
  deepLink: z.string().startsWith('/').max(500),
});

export const notificationReadSchema = z.object({
  notificationId: z.string().min(1),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export const notificationPreferencesSchema = z.object({
  APPROVAL: z.boolean(),
  SECURITY: z.boolean(),
  BUDGET: z.boolean(),
  QUOTA: z.boolean(),
  WORKFLOW: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const repositoryConnectionSchema = z.object({
  projectId: z.string().uuid(),
  providerType: z.enum(['GITHUB', 'GITLAB', 'BITBUCKET']),
  owner: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  defaultBranch: z.string().trim().min(1).max(120).default('main'),
});

export const taskStateSchema = z.enum([
  'DRAFT',
  'READY',
  'QUEUED',
  'RUNNING',
  'WAITING_DEPENDENCY',
  'WAITING_APPROVAL',
  'WAITING_PROVIDER_QUOTA',
  'WAITING_BUDGET_APPROVAL',
  'BLOCKED',
  'IMPLEMENTED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'CANCELED',
  'VERIFYING',
  'REVIEW_PENDING',
  'FIX_REQUIRED',
  'DONE',
]);

export const taskCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).default(''),
  taskType: z.enum(['FRONTEND', 'BACKEND', 'DESIGN', 'TEST', 'DOCS', 'REVIEW']),
  dependencies: z.array(z.string().uuid()).max(50).default([]),
  readScope: z.array(z.string().trim().min(1)).max(100).default([]),
  writeScope: z.array(z.string().trim().min(1)).max(100).default([]),
  requiredCapability: z.string().trim().min(1).max(80).optional(),
  parallelGroupId: z.string().trim().min(1).max(120).optional(),
  approvedDesignVersionId: z.string().uuid().optional(),
  estimatedCost: z.number().nonnegative().max(1_000_000).default(0),
  priority: z.number().int().min(-100).max(100).default(0),
});

export const taskTransitionSchema = z.object({
  state: taskStateSchema,
});
