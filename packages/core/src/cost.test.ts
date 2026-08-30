import { describe, expect, it } from 'vitest';
import { budgetDecision, forecastMonthlyCost, weeklyCostReport } from './index';

describe('deterministic cost forecast', () => {
  it('projects current month spend without an LLM', () => {
    expect(
      forecastMonthlyCost(
        [{ amount: 10, occurredAt: '2026-02-10T10:00:00Z', provider: 'fake', model: 'x' }],
        new Date('2026-02-10T12:00:00Z'),
      ),
    ).toBe(28);
    expect(budgetDecision(11, 10)).toBe('WAITING_BUDGET_APPROVAL');
    expect(budgetDecision(11, 10, true)).toBe('ALLOW');
    expect(
      weeklyCostReport(
        [{ amount: 3, occurredAt: '2026-02-10T00:00:00Z', provider: 'fake', model: 'x' }],
        new Date('2026-02-10T12:00:00Z'),
      ).byProvider,
    ).toEqual({ fake: 3 });
  });
});
