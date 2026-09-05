import { describe, expect, it } from 'vitest';
import { completedStageCount, projectProgress, type ProjectFacts } from './stage';

const fresh: ProjectFacts = {
  playbookKey: 'feature-on-existing-repo',
  briefApproved: false,
  approvedDesignVersions: 0,
  hasWorkflow: false,
  workTasks: [],
};

const at = (facts: Partial<ProjectFacts>) => projectProgress({ ...fresh, ...facts })!;
const statuses = (facts: Partial<ProjectFacts>) =>
  Object.fromEntries(at(facts).stages.map((entry) => [entry.stage.key, entry.status]));

describe('where a project has got to', () => {
  it('starts on discovery and says what closes it', () => {
    const progress = at({});
    expect(progress.current?.stage.key).toBe('discovery');
    expect(progress.current?.waitingFor).toContain('approve it');
    expect(completedStageCount(progress)).toBe(0);
  });

  it('moves to the specification once the brief is approved', () => {
    const progress = at({ briefApproved: true });
    expect(progress.current?.stage.key).toBe('spec');
    expect(progress.current?.waitingFor).toContain('Ask the Lead');
  });

  it('reports the state of the specification task while it runs', () => {
    const progress = at({ briefApproved: true, specTask: { state: 'RUNNING' } });
    expect(progress.current?.stage.key).toBe('spec');
    expect(progress.current?.waitingFor).toContain('running');
  });

  it('moves to decomposition once the document is done', () => {
    const progress = at({ briefApproved: true, specTask: { state: 'DONE' } });
    expect(progress.current?.stage.key).toBe('decomposition');
  });

  it('moves to execution once a plan has been committed', () => {
    const progress = at({
      briefApproved: true,
      specTask: { state: 'DONE' },
      hasWorkflow: true,
      workTasks: [{ state: 'QUEUED' }, { state: 'DONE' }],
    });
    expect(progress.current?.stage.key).toBe('execution');
    expect(progress.current?.waitingFor).toContain('1 task');
  });

  it('reaches delivery when every task is closed', () => {
    const progress = at({
      briefApproved: true,
      specTask: { state: 'DONE' },
      hasWorkflow: true,
      workTasks: [{ state: 'DONE' }, { state: 'CANCELED' }],
    });
    expect(progress.current?.stage.key).toBe('delivery');
  });

  it('does not let an optional stage hold the project', () => {
    // A project that needs no design should not sit on "design" waiting for an
    // approval that is never coming.
    expect(statuses({ briefApproved: true, specTask: { state: 'DONE' } })).toMatchObject({
      design: 'SKIPPED',
      decomposition: 'CURRENT',
    });
  });

  it('counts an optional stage as done once a design is approved', () => {
    expect(
      statuses({ briefApproved: true, specTask: { state: 'DONE' }, approvedDesignVersions: 1 }),
    ).toMatchObject({ design: 'DONE' });
  });

  it('follows the stages of the playbook that was chosen', () => {
    const redesign = at({ playbookKey: 'site-redesign' });
    expect(redesign.stages.map((entry) => entry.stage.key)).toEqual([
      'harvest',
      'discovery',
      'direction',
      'prototype',
      'spec',
      'decomposition',
      'execution',
      'delivery',
    ]);
    // Its first stage is the harvest, which the studio cannot do yet — the
    // progress says where it is, not whether the stage is possible.
    expect(redesign.current?.stage.key).toBe('harvest');
  });

  it('returns nothing for a playbook the studio does not have', () => {
    expect(projectProgress({ ...fresh, playbookKey: 'freestyle' })).toBeNull();
  });

  it('never reports two current stages', () => {
    for (const facts of [
      {},
      { briefApproved: true },
      { briefApproved: true, specTask: { state: 'DONE' as const } },
      { briefApproved: true, specTask: { state: 'DONE' as const }, hasWorkflow: true },
    ])
      expect(at(facts).stages.filter((entry) => entry.status === 'CURRENT')).toHaveLength(1);
  });
});
