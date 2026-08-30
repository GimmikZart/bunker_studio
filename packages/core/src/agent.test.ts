import { describe, expect, it } from 'vitest';
import { calculateAgentMetrics, derivePresence } from './index';

describe('agent projections', () => {
  it('derives office presence from durable runtime/task state', () => {
    expect(derivePresence({ online: true, taskState: 'CODING' })).toBe('CODING');
    expect(derivePresence({ online: true, taskState: 'WAITING_PROVIDER_QUOTA' })).toBe(
      'WAITING_QUOTA',
    );
    expect(derivePresence({ online: false })).toBe('OFFLINE');
  });

  it('calculates metrics deterministically', () => {
    expect(
      calculateAgentMetrics({
        completedTasks: 2,
        reviewedTasks: 2,
        passedReviews: 1,
        totalCost: 4,
        cycleTimesMs: [30, 10, 20],
      }),
    ).toEqual({
      tasksCompleted: 2,
      firstReviewPassRate: 0.5,
      averageTaskCost: 2,
      medianCycleTimeMs: 20,
    });
  });
});
