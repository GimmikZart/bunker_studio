import { describe, expect, it } from 'vitest';
import { evaluateBudgetPolicies, evaluateEscalation, nextWeeklyReportAt } from './index';

const basePolicy = {
  id: 'monthly',
  periodType: 'MONTHLY' as const,
  softLimit: 10,
  hardLimit: 20,
  currency: 'USD',
  actionOnSoft: 'REQUIRE_APPROVAL' as const,
  actionOnHard: 'BLOCK' as const,
  escalationThreshold: 2,
  allowProviderFallback: false,
  enabled: true,
};

describe('deterministic budget and escalation policies', () => {
  it('evaluates scoped monthly spend before a provider call', () => {
    const result = evaluateBudgetPolicies({
      policies: [basePolicy],
      entries: [
        {
          amount: 9,
          occurredAt: '2026-08-10T00:00:00Z',
          provider: 'fake',
          model: 'x',
          projectId: 'project-1',
        },
      ],
      estimatedCost: 2,
      context: { projectId: 'project-1' },
      now: new Date('2026-08-20T00:00:00Z'),
    });
    expect(result).toMatchObject({
      decision: 'WAITING_BUDGET_APPROVAL',
      usageByPolicy: { monthly: 9 },
      softLimitExceeded: ['monthly'],
      hardLimitExceeded: [],
    });
  });

  it('hard-stops paid work even when approval is present', () => {
    const result = evaluateBudgetPolicies({
      policies: [{ ...basePolicy, softLimit: 0, hardLimit: 10 }],
      entries: [],
      estimatedCost: 11,
      context: {},
      approvalGranted: true,
    });
    expect(result.decision).toBe('HARD_STOP');
  });

  it('raises escalation after repeated failures or an architectural finding', () => {
    expect(evaluateEscalation({ failedImplementationAttempts: 2 })).toEqual({
      escalate: true,
      reasons: ['FAILED_IMPLEMENTATION_ATTEMPTS'],
    });
    expect(evaluateEscalation({ reviewerRequiresArchitecture: true })).toEqual({
      escalate: true,
      reasons: ['ARCHITECTURAL_REVIEW'],
    });
  });

  it('computes the next weekly report slot deterministically in UTC', () => {
    expect(
      nextWeeklyReportAt(
        { dayOfWeek: 1, hourUtc: 9, minuteUtc: 30 },
        new Date('2026-08-31T08:00:00Z'),
      ).toISOString(),
    ).toBe('2026-08-31T09:30:00.000Z');
    expect(
      nextWeeklyReportAt(
        { dayOfWeek: 1, hourUtc: 9, minuteUtc: 30 },
        new Date('2026-08-31T10:00:00Z'),
      ).toISOString(),
    ).toBe('2026-09-07T09:30:00.000Z');
  });
});
