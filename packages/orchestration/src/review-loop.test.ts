import { describe, expect, it } from 'vitest';
import { runReviewFixLoop } from './review-loop';

describe('review/fix loop', () => {
  it('creates a follow-up fix and closes only after a passing re-review', async () => {
    const reviewed: number[] = [];
    const result = await runReviewFixLoop({
      review: (cycle) => {
        reviewed.push(cycle);
        return cycle === 1 ? [{ severity: 'HIGH', blocking: true, title: 'Missing test' }] : [];
      },
      applyFixes: () => undefined,
    });
    expect(result.status).toBe('DONE');
    expect(reviewed).toEqual([1, 2]);
    expect(result.fixTaskTitles).toEqual(['Fix review finding: Missing test']);
  });

  it('keeps completion blocked after the cycle limit', async () => {
    const result = await runReviewFixLoop({
      maxCycles: 2,
      review: () => [{ severity: 'CRITICAL', blocking: true, title: 'Security issue' }],
      applyFixes: () => undefined,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.cycles).toHaveLength(2);
  });
});
