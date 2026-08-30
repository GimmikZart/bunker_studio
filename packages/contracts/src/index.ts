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

export const verificationRunSchema = z.object({
  kind: z.enum(['FORMAT', 'LINT', 'TYPECHECK', 'UNIT', 'INTEGRATION', 'E2E', 'SECURITY', 'BUILD']),
  commandOrCheck: z.string().min(1),
  status: z.enum(['PASS', 'FAIL', 'SKIPPED']),
  artifactId: z.string().optional(),
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
});
export type ReviewReport = z.infer<typeof reviewReportSchema>;

export const designVersionSchema = z.object({
  versionNumber: z.number().int().positive().max(3),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED']),
  spec: z.record(z.unknown()),
  rationale: z.string(),
  previewArtifactIds: z.array(z.string()),
});
export type DesignVersion = z.infer<typeof designVersionSchema>;

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
