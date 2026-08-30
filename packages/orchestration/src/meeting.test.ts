import { describe, expect, it } from 'vitest';
import { distillMeetingContext, nextMeetingRound } from './index';

describe('bounded meetings', () => {
  it('enforces two rounds unless the lead declares an unresolved conflict', () => {
    expect(nextMeetingRound([{ agentId: 'a', round: 1, content: 'one' }], 5)).toBe(2);
    expect(nextMeetingRound([{ agentId: 'a', round: 2, content: 'two' }], 5)).toBeNull();
    expect(nextMeetingRound([{ agentId: 'a', round: 2, content: 'two' }], 5, true)).toBe(3);
  });

  it('bounds distilled context', () => {
    expect(distillMeetingContext([{ agentId: 'a', round: 1, content: 'abcdef' }], 10)).toHaveLength(
      10,
    );
  });
});
