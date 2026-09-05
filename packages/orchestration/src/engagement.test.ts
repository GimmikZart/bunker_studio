import { describe, expect, it } from 'vitest';
import { buildEngagementPrompt, parseEngagementReply } from './engagement';
import { PLAYBOOKS, unavailableStages, findPlaybook } from './playbooks';

const complete = {
  questions: [],
  understanding: 'Rebuild the checkout so a guest can pay without an account.',
  openPoints: [],
  proposedScope: ['Guest checkout'],
  outOfScope: ['Payment provider migration'],
  playbookKey: 'feature-on-existing-repo',
  readyForApproval: true,
};

describe('the engagement prompt', () => {
  it('offers only playbooks the studio actually has', () => {
    const prompt = buildEngagementPrompt({
      agentTitle: 'Lead Architect',
      projectName: 'Vrsus App',
      repository: 'GimmikZart/vrsus_website',
      turns: [],
      message: 'I want a guest checkout.',
    });
    for (const playbook of PLAYBOOKS) expect(prompt).toContain(playbook.key);
    expect(prompt).toContain('GimmikZart/vrsus_website');
  });

  it('replays only the recent turns, so a long conversation does not keep growing', () => {
    const turns = Array.from({ length: 30 }, (_, index) => ({
      role: 'USER' as const,
      content: `turn number ${index}`,
    }));
    const prompt = buildEngagementPrompt({
      agentTitle: 'Lead',
      projectName: 'P',
      repository: null,
      turns,
      message: 'and now?',
    });
    expect(prompt).not.toContain('turn number 0');
    expect(prompt).toContain('turn number 29');
  });
});

describe('reading the Lead reply', () => {
  it('accepts a complete brief', () => {
    const outcome = parseEngagementReply(JSON.stringify(complete));
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.brief.readyForApproval).toBe(true);
    expect(outcome.ok && outcome.correctedPlaybook).toBe(false);
  });

  it('reads a brief wrapped in prose or a code fence', () => {
    const outcome = parseEngagementReply(
      `Here is what I understood.\n\`\`\`json\n${JSON.stringify(complete)}\n\`\`\`\nLet me know.`,
    );
    expect(outcome.ok).toBe(true);
  });

  it('refuses to call a brief ready while its own questions are unanswered', () => {
    const outcome = parseEngagementReply(
      JSON.stringify({ ...complete, questions: ['Which payment provider?'] }),
    );
    expect(outcome.ok && outcome.brief.readyForApproval).toBe(false);
  });

  it('falls back to the default playbook and says it did', () => {
    const outcome = parseEngagementReply(
      JSON.stringify({ ...complete, playbookKey: 'invent-something' }),
    );
    expect(outcome.ok && outcome.correctedPlaybook).toBe(true);
    expect(outcome.ok && outcome.brief.playbookKey).toBe('feature-on-existing-repo');
  });

  it('refuses an answer with no understanding in it', () => {
    const outcome = parseEngagementReply(JSON.stringify({ ...complete, understanding: '   ' }));
    expect(outcome.ok).toBe(false);
  });

  it('refuses prose', () => {
    const outcome = parseEngagementReply('I think we should start with the checkout.');
    expect(outcome.ok).toBe(false);
  });

  it('refuses an answer longer than the studio will read', () => {
    const outcome = parseEngagementReply('x'.repeat(40_001));
    expect(outcome.ok).toBe(false);
  });
});

describe('the playbooks', () => {
  it('share their stages rather than repeating them', () => {
    const feature = findPlaybook('feature-on-existing-repo')!;
    const redesign = findPlaybook('site-redesign')!;
    const shared = feature.stages
      .map((stage) => stage.key)
      .filter((key) => redesign.stages.some((stage) => stage.key === key));
    expect(shared).toEqual(['discovery', 'spec', 'decomposition', 'execution', 'delivery']);
  });

  it('names the stages that cannot run yet instead of failing halfway', () => {
    const redesign = findPlaybook('site-redesign')!;
    const blocked = unavailableStages(redesign, []);
    expect(blocked.map((entry) => entry.stage.key)).toEqual(['harvest', 'prototype']);
    expect(unavailableStages(redesign, ['WEB_HARVEST', 'DESIGN_PROTOTYPE'])).toEqual([]);
  });

  it('gives every playbook a unique key and at least one human gate', () => {
    expect(new Set(PLAYBOOKS.map((playbook) => playbook.key)).size).toBe(PLAYBOOKS.length);
    for (const playbook of PLAYBOOKS)
      expect(playbook.stages.some((stage) => stage.gate === 'HUMAN_APPROVAL')).toBe(true);
  });
});
