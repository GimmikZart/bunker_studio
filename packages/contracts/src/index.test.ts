import { describe, expect, it } from 'vitest';
import {
  healthResponseSchema,
  leadPlanSchema,
  reviewReportSchema,
  verificationRunSchema,
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
});
