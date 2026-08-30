import { describe, expect, it } from 'vitest';
import {
  designVersionSchema,
  meetingMinutesSchema,
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
});
