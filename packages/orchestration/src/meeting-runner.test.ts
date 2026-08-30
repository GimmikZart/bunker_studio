import { describe, expect, it } from 'vitest';
import { runBoundedMeeting } from './meeting';

describe('bounded meeting runner', () => {
  it('runs participant contributions in parallel and respects the round cap', async () => {
    const result = await runBoundedMeeting({
      agentIds: ['a', 'b', 'c'],
      maxRounds: 9,
      contribute: async (agentId, round) => `${agentId} says ${round}`,
      shouldContinue: (contributions) => contributions.length < 6,
    });
    expect(result.contributions).toHaveLength(6);
    expect(result.roundsUsed).toBe(2);
    expect(result.distilledContext).toContain('a/round-1');
  });
});
