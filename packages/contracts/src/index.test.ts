import { describe, expect, it } from 'vitest';
import {
  healthResponseSchema,
  leadPlanSchema,
  reviewReportSchema,
  verificationRunSchema,
  workerRegistrationTokenCreateSchema,
  workerRuntimeRegistrationSchema,
  workerTaskCompletionSchema,
} from './index';

describe('contracts', () => {
  it('validates normalized health responses', () => {
    expect(
      healthResponseSchema.parse({
        service: 'web',
        status: 'ok',
        timestamp: new Date().toISOString(),
      }),
    ).toEqual(expect.objectContaining({ service: 'web', status: 'ok' }));
  });

  it('validates structured lead, verification and review contracts', () => {
    expect(
      leadPlanSchema.parse({
        goal: 'Ship feature',
        assumptions: [],
        tasks: [
          {
            id: 'api',
            title: 'API',
            taskType: 'BACKEND',
            description: 'Build API',
            dependencies: [],
            readScope: ['src'],
            writeScope: ['src/api'],
            definitionOfDone: ['Tests pass'],
            estimatedCost: 1,
          },
        ],
        verificationSteps: ['pnpm test'],
      }),
    ).toBeTruthy();
    expect(
      reviewReportSchema.parse({
        candidateSha: 'abc',
        status: 'PASS',
        summary: 'ok',
        findings: [],
        verificationRuns: [
          { kind: 'UNIT', commandOrCheck: 'pnpm test', status: 'PASS', durationMs: 1 },
        ],
      }),
    ).toBeTruthy();
    expect(
      verificationRunSchema.safeParse({
        kind: 'UNIT',
        commandOrCheck: '',
        status: 'PASS',
        durationMs: 1,
      }).success,
    ).toBe(false);
  });

  it('keeps local worker registration credentials out of the persisted node contract', () => {
    expect(
      workerRegistrationTokenCreateSchema.parse({
        allowedScopes: ['apps/web'],
        maxConcurrent: 2,
        expiresInMinutes: 30,
      }),
    ).toMatchObject({ maxConcurrent: 2 });
    expect(
      workerRuntimeRegistrationSchema.parse({
        name: 'Ollama node',
        capabilities: ['ollama', 'chat'],
        registrationToken: 'a'.repeat(64),
      }).registrationToken,
    ).toHaveLength(64);
    expect(
      workerTaskCompletionSchema.parse({
        nodeId: '55555555-5555-4555-8555-555555555555',
        leaseId: '11111111-1111-4111-8111-111111111111',
        success: true,
      }),
    ).toMatchObject({ success: true, result: {} });
  });
});
