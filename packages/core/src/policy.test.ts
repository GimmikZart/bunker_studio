import { describe, expect, it } from 'vitest';
import {
  createFixTaskTitles,
  evaluateReviewCycle,
  protectedProjectPolicy,
  requiresDesignApproval,
  reviewBlocksCompletion,
  reviewOutcome,
} from './index';

describe('control-plane policies', () => {
  it('blocks high and critical review findings', () => {
    expect(reviewBlocksCompletion([{ severity: 'HIGH', blocking: false }])).toBe(true);
    expect(reviewBlocksCompletion([{ severity: 'LOW', blocking: false }])).toBe(false);
    expect(reviewOutcome([{ severity: 'HIGH', blocking: true }])).toBe('FIX_REQUIRED');
    expect(createFixTaskTitles([{ title: 'Missing test', blocking: true }])).toEqual([
      'Fix review finding: Missing test',
    ]);
    expect(evaluateReviewCycle([{ title: 'Bug', severity: 'HIGH', blocking: true }])).toEqual({
      outcome: 'FIX_REQUIRED',
      fixTaskTitles: ['Fix review finding: Bug'],
      completionBlocked: true,
    });
  });

  it('requires immutable design approval for major changes', () => {
    expect(requiresDesignApproval(true)).toBe(true);
    expect(requiresDesignApproval(true, 'design-v1')).toBe(false);
  });

  it('protects Studio core deploy and policy edits', () => {
    expect(protectedProjectPolicy({ isStudioCore: true, requestedAction: 'DEPLOY' })).toEqual({
      allowed: false,
      approvalRequired: true,
    });
    expect(protectedProjectPolicy({ isStudioCore: true, requestedAction: 'MERGE' })).toEqual({
      allowed: true,
      approvalRequired: true,
    });
  });
});
