import { describe, expect, it } from 'vitest';
import {
  buildMeetingContributionPrompt,
  buildMeetingMinutesPrompt,
  fallbackMeetingMinutes,
  parseMeetingMinutes,
} from './meeting-agenda.js';

const LEAD = '11111111-1111-4111-8111-111111111111';
const REVIEWER = '22222222-2222-4222-8222-222222222222';
const OUTSIDER = '33333333-3333-4333-8333-333333333333';

describe('buildMeetingContributionPrompt', () => {
  it('opens the first round with the agenda and no prior context', () => {
    const prompt = buildMeetingContributionPrompt({
      agentTitle: 'Reviewer / QA / Security',
      meetingTitle: 'Release readiness',
      agenda: ['Decide the cut-off date', 'Agree the rollback plan'],
      round: 1,
      boundedContext: '',
    });
    expect(prompt).toContain('Reviewer / QA / Security');
    expect(prompt).toContain('Release readiness');
    expect(prompt).toContain('1. Decide the cut-off date');
    expect(prompt).toContain('Nothing has been said yet.');
    expect(prompt).toContain('You are speaking first');
  });

  it('gives later rounds the digest instead of the raw transcript', () => {
    const prompt = buildMeetingContributionPrompt({
      agentTitle: 'Backend Engineer',
      meetingTitle: 'Release readiness',
      agenda: ['Decide the cut-off date'],
      round: 2,
      boundedContext: '[lead/round-1] We should cut on Friday.',
    });
    expect(prompt).toContain('What has been said so far (digest):');
    expect(prompt).toContain('We should cut on Friday.');
    expect(prompt).toContain('Respond to what your colleagues said');
  });

  it('bounds an oversized agenda', () => {
    const prompt = buildMeetingContributionPrompt({
      agentTitle: 'Lead',
      meetingTitle: 'Planning',
      agenda: Array.from({ length: 50 }, (_, index) => `Point ${index}`),
      round: 1,
      boundedContext: '',
    });
    expect(prompt).toContain('Point 19');
    expect(prompt).not.toContain('Point 20');
  });
});

describe('buildMeetingMinutesPrompt', () => {
  it('includes the contributions and restricts owners to attendees', () => {
    const prompt = buildMeetingMinutesPrompt({
      meetingTitle: 'Release readiness',
      agenda: ['Decide the cut-off date'],
      contributions: [{ agentId: LEAD, round: 1, content: 'Cut on Friday.' }],
      participantAgentIds: [LEAD, REVIEWER],
    });
    expect(prompt).toContain('Cut on Friday.');
    expect(prompt).toContain(LEAD);
    expect(prompt).toContain(REVIEWER);
    expect(prompt).toContain('must be one of these agent ids');
  });
});

describe('parseMeetingMinutes', () => {
  it('accepts well-formed minutes wrapped in prose', () => {
    const body = JSON.stringify({
      summary: 'The team agreed to cut on Friday.',
      decisions: [{ title: 'Cut-off date', decision: 'Friday.' }],
      actionItems: [{ title: 'Prepare the rollback plan', ownerAgentId: REVIEWER }],
    });
    const result = parseMeetingMinutes(`Minutes:\n\`\`\`json\n${body}\n\`\`\``, [LEAD, REVIEWER]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.minutes.decisions).toHaveLength(1);
      expect(result.minutes.actionItems[0]?.ownerAgentId).toBe(REVIEWER);
    }
  });

  it('defaults decisions and action items when the Lead records none', () => {
    const result = parseMeetingMinutes('{"summary":"No decision was reached."}', [LEAD]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.minutes.decisions).toEqual([]);
      expect(result.minutes.actionItems).toEqual([]);
    }
  });

  it('rejects an action item assigned to someone who did not attend', () => {
    const body = JSON.stringify({
      summary: 'Discussed the plan.',
      decisions: [],
      actionItems: [{ title: 'Do the work', ownerAgentId: OUTSIDER }],
    });
    const result = parseMeetingMinutes(body, [LEAD, REVIEWER]);
    expect(result).toEqual({
      ok: false,
      reason: 'An action item was assigned to an agent that did not attend.',
    });
  });

  it('rejects a response that is not JSON or does not match the shape', () => {
    expect(parseMeetingMinutes('We agreed on Friday.', [LEAD]).ok).toBe(false);
    expect(parseMeetingMinutes('{"summary":""}', [LEAD]).ok).toBe(false);
  });

  it('rejects an oversized response before parsing it', () => {
    const result = parseMeetingMinutes(`{"summary":"${'x'.repeat(40_001)}"}`, [LEAD]);
    expect(result).toEqual({
      ok: false,
      reason: 'The minutes response exceeded the accepted size.',
    });
  });
});

describe('fallbackMeetingMinutes', () => {
  it('records no decisions when none can be proven', () => {
    const minutes = fallbackMeetingMinutes('[lead/round-1] We discussed the date.');
    expect(minutes.decisions).toEqual([]);
    expect(minutes.actionItems).toEqual([]);
    expect(minutes.summary).toContain('We discussed the date.');
  });

  it('stays valid for an empty meeting', () => {
    expect(fallbackMeetingMinutes('').summary).toBe('No contributions were recorded.');
  });
});
