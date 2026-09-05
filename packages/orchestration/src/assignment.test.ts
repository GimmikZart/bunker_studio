import { describe, expect, it } from 'vitest';
import { assignTasks, selectAgentForTask } from './assignment';

const team = [
  { id: 'a-lead', roleKey: 'lead', skills: ['planning'], activeTaskCount: 0 },
  {
    id: 'b-frontend',
    roleKey: 'frontend',
    skills: ['frontend', 'accessibility'],
    activeTaskCount: 0,
  },
  { id: 'c-frontend', roleKey: 'frontend', skills: ['frontend'], activeTaskCount: 0 },
  { id: 'd-backend', roleKey: 'backend', skills: ['backend'], activeTaskCount: 0 },
];

describe('task assignment', () => {
  it('gives the work to the role that owns it', () => {
    expect(selectAgentForTask({ taskType: 'BACKEND' }, team)).toEqual({
      ok: true,
      agentId: 'd-backend',
    });
  });

  it('refuses a review when the project has no reviewer', () => {
    const outcome = selectAgentForTask({ taskType: 'REVIEW' }, team);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toContain('reviewer');
  });

  it('refuses a task whose required capability nobody declares', () => {
    const outcome = selectAgentForTask(
      { taskType: 'BACKEND', requiredCapability: 'kubernetes' },
      team,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toContain('kubernetes');
  });

  it('prefers the capable agent even when another shares the role', () => {
    expect(
      selectAgentForTask({ taskType: 'FRONTEND', requiredCapability: 'accessibility' }, team),
    ).toEqual({ ok: true, agentId: 'b-frontend' });
  });

  it('falls back to any capable agent for work with no dedicated role', () => {
    // Nobody has the 'lead' role removed here, but DOCS prefers it and accepts
    // anyone: the studio should not stall for want of a technical writer.
    const withoutLead = team.filter((agent) => agent.roleKey !== 'lead');
    const outcome = selectAgentForTask({ taskType: 'DOCS' }, withoutLead);
    expect(outcome.ok).toBe(true);
  });

  it('spreads a plan across the team instead of stacking one agent', () => {
    const plan = assignTasks(
      [
        { taskType: 'FRONTEND' as const },
        { taskType: 'FRONTEND' as const },
        { taskType: 'FRONTEND' as const },
      ],
      team,
    );
    expect(plan.unassigned).toEqual([]);
    expect(plan.assigned.map((entry) => entry.agentId)).toEqual([
      'b-frontend',
      'c-frontend',
      'b-frontend',
    ]);
  });

  it('reports the tasks nobody can take rather than guessing', () => {
    const plan = assignTasks(
      [{ taskType: 'BACKEND' as const }, { taskType: 'REVIEW' as const }],
      team,
    );
    expect(plan.assigned).toHaveLength(1);
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0]!.reason).toContain('reviewer');
  });

  it('says the project is empty when it has no agents at all', () => {
    const outcome = selectAgentForTask({ taskType: 'BACKEND' }, []);
    expect(outcome.ok === false && outcome.reason).toContain('no agent assigned');
  });

  it('is stable: the same inputs always choose the same agent', () => {
    const first = selectAgentForTask({ taskType: 'FRONTEND' }, team);
    const reordered = selectAgentForTask({ taskType: 'FRONTEND' }, [...team].reverse());
    expect(first).toEqual(reordered);
  });
});
