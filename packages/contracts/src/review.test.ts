import { describe, expect, it } from 'vitest';
import {
  budgetPolicySchema,
  designVersionSchema,
  meetingMinutesSchema,
  reportScheduleSchema,
  reviewFindingSchema,
  staffingProposalSchema,
} from './index';

describe('structured workflow contracts', () => {
  it('accepts review, design, staffing and meeting payloads', () => {
    expect(
      reviewFindingSchema.parse({
        severity: 'HIGH',
        category: 'SECURITY',
        title: 'Issue',
        description: 'Details',
        evidence: 'line 1',
        recommendation: 'Fix',
        blocking: true,
        confidence: 0.99,
      }),
    ).toBeTruthy();
    expect(
      designVersionSchema.parse({
        versionNumber: 1,
        status: 'SUBMITTED',
        spec: {},
        rationale: 'Clear',
        previewArtifactIds: [],
      }),
    ).toBeTruthy();
    expect(
      staffingProposalSchema.parse({
        roleKey: 'frontend',
        title: 'Frontend',
        modelTier: 'ECONOMY_WORKER',
        skills: [],
        tools: [],
        estimatedCost: 2,
        rationale: 'Scope fit',
      }),
    ).toBeTruthy();
    expect(
      meetingMinutesSchema.parse({ summary: 'Done', decisions: [], actionItems: [] }),
    ).toBeTruthy();
  });

  it('validates bounded budget policies and weekly report schedules', () => {
    expect(
      budgetPolicySchema.parse({
        periodType: 'MONTHLY',
        softLimit: 10,
        hardLimit: 20,
        currency: 'USD',
        actionOnSoft: 'REQUIRE_APPROVAL',
        actionOnHard: 'BLOCK',
        escalationThreshold: 2,
        allowProviderFallback: false,
        enabled: true,
      }).periodType,
    ).toBe('MONTHLY');
    expect(() =>
      budgetPolicySchema.parse({
        periodType: 'DAILY',
        softLimit: 21,
        hardLimit: 20,
        currency: 'USD',
        actionOnSoft: 'NOTIFY',
        actionOnHard: 'BLOCK',
        escalationThreshold: 2,
        allowProviderFallback: false,
        enabled: true,
      }),
    ).toThrow();
    expect(
      reportScheduleSchema.parse({
        frequency: 'WEEKLY',
        dayOfWeek: 1,
        hourUtc: 9,
        minuteUtc: 30,
        timezone: 'Europe/Rome',
        recipients: ['owner@example.com'],
        enabled: true,
      }).frequency,
    ).toBe('WEEKLY');
  });
});
