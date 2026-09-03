import { describe, expect, it } from 'vitest';
import type { LeadPlan, LeadTask } from '@bunker-studio/contracts';
import {
  buildLeadPlanPrompt,
  MAX_LEAD_PLAN_TASKS,
  orderLeadPlanTasks,
  parseLeadPlanProposal,
  validateLeadPlanProposal,
} from './lead-planner.js';

const APPROVED_DESIGN = '11111111-1111-4111-8111-111111111111';

function task(overrides: Partial<LeadTask> & { id: string }): LeadTask {
  return {
    title: `Task ${overrides.id}`,
    taskType: 'BACKEND',
    description: 'Bounded description.',
    dependencies: [],
    readScope: ['packages/core'],
    writeScope: [`packages/${overrides.id}`],
    definitionOfDone: ['Tests pass.'],
    verificationCommands: [],
    estimatedCost: 1,
    ...overrides,
  };
}

function plan(tasks: LeadTask[]): LeadPlan {
  return {
    goal: 'Ship the billing module.',
    assumptions: ['The schema is stable.'],
    verificationSteps: ['pnpm verify'],
    tasks,
  };
}

const context = {
  approvedDesignVersionIds: [APPROVED_DESIGN],
  remainingBudget: 100,
  teamCapabilities: ['typescript', 'postgres'],
};

describe('buildLeadPlanPrompt', () => {
  it('states the goal, the approved designs and the remaining budget', () => {
    const prompt = buildLeadPlanPrompt({
      goal: 'Ship the billing module.',
      constraints: ['No new dependencies.'],
      teamCapabilities: ['typescript'],
      approvedDesignVersionIds: [APPROVED_DESIGN],
      remainingBudget: 42,
      existingTaskTitles: ['Set up CI'],
    });
    expect(prompt).toContain('Ship the billing module.');
    expect(prompt).toContain('No new dependencies.');
    expect(prompt).toContain(APPROVED_DESIGN);
    expect(prompt).toContain('Remaining budget for this plan: 42');
    expect(prompt).toContain('Set up CI');
  });

  it('says so plainly when no hard budget cap is configured', () => {
    const prompt = buildLeadPlanPrompt({
      goal: 'Goal.',
      constraints: [],
      teamCapabilities: [],
      approvedDesignVersionIds: [],
      remainingBudget: null,
      existingTaskTitles: [],
    });
    expect(prompt).toContain('no hard cap is configured');
    expect(prompt).not.toContain('does not exceed the remaining budget');
  });

  it('bounds the prompt instead of replaying an unbounded project history', () => {
    const prompt = buildLeadPlanPrompt({
      goal: 'Goal.',
      constraints: [],
      teamCapabilities: [],
      approvedDesignVersionIds: [],
      remainingBudget: 10,
      existingTaskTitles: Array.from({ length: 200 }, (_, index) => `Historic task ${index}`),
    });
    expect(prompt).toContain('Historic task 39');
    expect(prompt).not.toContain('Historic task 40');
  });
});

describe('parseLeadPlanProposal', () => {
  it('accepts a JSON object wrapped in a fenced block and prose', () => {
    const body = JSON.stringify(plan([task({ id: 'api' })]));
    const result = parseLeadPlanProposal(`Here is the plan.\n\n\`\`\`json\n${body}\n\`\`\`\nDone.`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.tasks).toHaveLength(1);
  });

  it('rejects a response that is not JSON', () => {
    const result = parseLeadPlanProposal('I will start by creating the tasks.');
    expect(result).toEqual({
      ok: false,
      reasons: ['The Lead response did not contain a JSON object.'],
    });
  });

  it('rejects a JSON object that does not match the plan schema', () => {
    const result = parseLeadPlanProposal('{"goal":"Ship it","tasks":[]}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('rejects an oversized response before parsing it', () => {
    const result = parseLeadPlanProposal(`{"goal":"${'x'.repeat(200_001)}"}`);
    expect(result).toEqual({
      ok: false,
      reasons: ['The Lead response exceeded the accepted size.'],
    });
  });
});

describe('orderLeadPlanTasks', () => {
  it('orders dependents after their prerequisites', () => {
    const order = orderLeadPlanTasks([
      { id: 'ship', dependencies: ['api', 'ui'] },
      { id: 'api', dependencies: [] },
      { id: 'ui', dependencies: ['api'] },
    ]);
    expect(order).toEqual(['api', 'ui', 'ship']);
  });

  it('returns null for a cycle', () => {
    expect(
      orderLeadPlanTasks([
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: ['a'] },
      ]),
    ).toBeNull();
  });

  it('returns null for duplicate ids and unknown dependencies', () => {
    expect(
      orderLeadPlanTasks([
        { id: 'a', dependencies: [] },
        { id: 'a', dependencies: [] },
      ]),
    ).toBeNull();
    expect(orderLeadPlanTasks([{ id: 'a', dependencies: ['ghost'] }])).toBeNull();
  });
});

describe('validateLeadPlanProposal', () => {
  it('accepts a plan that satisfies every gate and returns its execution order', () => {
    const result = validateLeadPlanProposal(
      plan([
        task({ id: 'api' }),
        task({
          id: 'ui',
          taskType: 'FRONTEND',
          dependencies: ['api'],
          writeScope: ['apps/web'],
          approvedDesignVersionId: APPROVED_DESIGN,
        }),
      ]),
      context,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order).toEqual(['api', 'ui']);
  });

  it('rejects a frontend task without an approved design version', () => {
    const result = validateLeadPlanProposal(
      plan([task({ id: 'ui', taskType: 'FRONTEND', writeScope: ['apps/web'] })]),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasons).toContain(
        'Frontend task "ui" does not reference an approved design version.',
      );
  });

  it('rejects a frontend task pointing at a design version that is not approved', () => {
    const result = validateLeadPlanProposal(
      plan([
        task({
          id: 'ui',
          taskType: 'FRONTEND',
          writeScope: ['apps/web'],
          approvedDesignVersionId: '22222222-2222-4222-8222-222222222222',
        }),
      ]),
      context,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a writing task with no declared write scope', () => {
    const result = validateLeadPlanProposal(plan([task({ id: 'api', writeScope: [] })]), context);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasons).toContain('Task "api" changes files but declares no write scope.');
  });

  it('keeps review tasks read-only', () => {
    const result = validateLeadPlanProposal(
      plan([task({ id: 'review', taskType: 'REVIEW', writeScope: ['packages/core'] })]),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasons).toContain(
        'Task "review" is read-only and must not declare a write scope.',
      );
  });

  it('rejects a parallel group whose members write overlapping paths', () => {
    const result = validateLeadPlanProposal(
      plan([
        task({ id: 'a', parallelGroupId: 'batch', writeScope: ['apps/web'] }),
        task({ id: 'b', parallelGroupId: 'batch', writeScope: ['apps/web/app'] }),
      ]),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasons).toContain(
        'Parallel group "batch" pairs "a" and "b" on overlapping write scopes.',
      );
  });

  it('allows a parallel group whose members write disjoint paths', () => {
    const result = validateLeadPlanProposal(
      plan([
        task({ id: 'a', parallelGroupId: 'batch', writeScope: ['apps/web'] }),
        task({ id: 'b', parallelGroupId: 'batch', writeScope: ['apps/worker'] }),
      ]),
      context,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a plan that costs more than the remaining budget', () => {
    const result = validateLeadPlanProposal(
      plan([task({ id: 'a', estimatedCost: 80 }), task({ id: 'b', estimatedCost: 40 })]),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasons).toContain(
        'The plan estimates 120, above the remaining budget of 100.',
      );
  });

  it('skips the cost gate when no hard budget is configured', () => {
    const result = validateLeadPlanProposal(plan([task({ id: 'a', estimatedCost: 9_999 })]), {
      ...context,
      remainingBudget: null,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a capability the team does not have', () => {
    const result = validateLeadPlanProposal(
      plan([task({ id: 'a', requiredCapability: 'rust' })]),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasons).toContain(
        'Task "a" requires capability "rust", which the team does not have.',
      );
  });

  it('rejects a dependency cycle and a self dependency', () => {
    const cycle = validateLeadPlanProposal(
      plan([task({ id: 'a', dependencies: ['b'] }), task({ id: 'b', dependencies: ['a'] })]),
      context,
    );
    expect(cycle.ok).toBe(false);
    const self = validateLeadPlanProposal(plan([task({ id: 'a', dependencies: ['a'] })]), context);
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.reasons).toContain('Task "a" depends on itself.');
  });

  it('rejects a plan larger than the task cap', () => {
    const tasks = Array.from({ length: MAX_LEAD_PLAN_TASKS + 1 }, (_, index) =>
      task({ id: `t${index}`, estimatedCost: 0 }),
    );
    const result = validateLeadPlanProposal(plan(tasks), context);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reasons).toContain(`A plan may contain at most ${MAX_LEAD_PLAN_TASKS} tasks.`);
  });

  it('reports every violated gate at once', () => {
    const result = validateLeadPlanProposal(
      plan([task({ id: 'a', writeScope: [], estimatedCost: 500, requiredCapability: 'rust' })]),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
