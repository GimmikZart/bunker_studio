import { describe, expect, it } from 'vitest';
import type { ReviewFinding } from '@bunker-studio/contracts';
import {
  buildReviewPrompt,
  composeReviewReport,
  parseReviewDraft,
  renderReviewDiff,
} from './review-brief.js';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

function finding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    severity: 'HIGH',
    category: 'CORRECTNESS',
    title: 'Off-by-one in pagination',
    description: 'The last page is dropped.',
    evidence: 'apps/web/list.ts line 42',
    recommendation: 'Use <= instead of <.',
    blocking: true,
    confidence: 0.9,
    ...overrides,
  };
}

describe('renderReviewDiff', () => {
  it('renders each file with its header and patch', () => {
    const rendered = renderReviewDiff([
      { filename: 'a.ts', status: 'modified', additions: 3, deletions: 1, patch: '@@ -1 +1 @@' },
    ]);
    expect(rendered).toContain('--- a.ts (modified, +3 -1)');
    expect(rendered).toContain('@@ -1 +1 @@');
  });

  it('says plainly when files were left out rather than truncating silently', () => {
    const rendered = renderReviewDiff(
      [
        { filename: 'small.ts', status: 'modified', additions: 1, deletions: 0, patch: 'ok' },
        {
          filename: 'huge.ts',
          status: 'modified',
          additions: 1,
          deletions: 0,
          patch: 'x'.repeat(500),
        },
      ],
      120,
    );
    expect(rendered).toContain('small.ts');
    expect(rendered).toContain('exceeded the diff budget');
  });

  it('reports a candidate with no textual changes', () => {
    expect(renderReviewDiff([])).toBe('The candidate contains no textual changes.');
  });

  it('notes files beyond the per-review file cap', () => {
    const files = Array.from({ length: 70 }, (_, index) => ({
      filename: `file-${index}.ts`,
      status: 'modified',
      additions: 1,
      deletions: 0,
      patch: 'x',
    }));
    expect(renderReviewDiff(files)).toContain('further file(s) were not included');
  });
});

describe('buildReviewPrompt', () => {
  it('states the task, the definition of done, the commit and the diff', () => {
    const prompt = buildReviewPrompt({
      reviewerTitle: 'Reviewer / QA / Security',
      taskTitle: 'Add billing routes',
      taskDescription: 'Expose the billing API.',
      definitionOfDone: ['Route tests pass.'],
      candidateCommitSha: SHA,
      files: [
        { filename: 'a.ts', status: 'modified', additions: 1, deletions: 0, patch: '@@ x @@' },
      ],
      verification: [
        {
          kind: 'UNIT',
          command: 'pnpm test',
          status: 'PASS',
          exitCode: 0,
          timedOut: false,
          durationMs: 10,
        },
      ],
    });
    expect(prompt).toContain('Add billing routes');
    expect(prompt).toContain('Route tests pass.');
    expect(prompt).toContain(SHA);
    expect(prompt).toContain('UNIT: PASS');
    expect(prompt).toContain('--- a.ts');
  });

  it('forbids the Reviewer from declaring the outcome', () => {
    const prompt = buildReviewPrompt({
      reviewerTitle: 'Reviewer',
      taskTitle: 'T',
      taskDescription: '',
      definitionOfDone: [],
      candidateCommitSha: SHA,
      files: [],
      verification: [],
    });
    expect(prompt).toContain('Do not state whether the review passes');
    expect(prompt).toContain('no deterministic verification was recorded');
  });
});

describe('parseReviewDraft', () => {
  it('accepts a well-formed draft wrapped in a fenced block', () => {
    const body = JSON.stringify({ summary: 'One blocking issue.', findings: [finding()] });
    const result = parseReviewDraft(`Review:\n\`\`\`json\n${body}\n\`\`\``);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.findings).toHaveLength(1);
  });

  it('accepts a clean review with no findings', () => {
    const result = parseReviewDraft('{"summary":"The change is sound."}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.findings).toEqual([]);
  });

  it('rejects a response that is not JSON or does not match the shape', () => {
    expect(parseReviewDraft('Looks good to me.').ok).toBe(false);
    expect(parseReviewDraft('{"summary":""}').ok).toBe(false);
    expect(
      parseReviewDraft(JSON.stringify({ summary: 'x', findings: [{ title: 'incomplete' }] })).ok,
    ).toBe(false);
  });

  it('rejects an oversized response before parsing it', () => {
    const result = parseReviewDraft(`{"summary":"${'x'.repeat(120_001)}"}`);
    expect(result).toEqual({
      ok: false,
      reason: 'The review response exceeded the accepted size.',
    });
  });
});

describe('composeReviewReport', () => {
  it('derives FIX_REQUIRED from a blocking finding', () => {
    const report = composeReviewReport(
      { summary: 'One blocking issue.', findings: [finding()] },
      SHA,
    );
    expect(report.status).toBe('FIX_REQUIRED');
    expect(report.candidateSha).toBe(SHA);
  });

  it('derives PASS when nothing blocks', () => {
    const report = composeReviewReport({ summary: 'Sound.', findings: [] }, SHA);
    expect(report.status).toBe('PASS');
  });

  it('cannot be talked into PASS while blocking findings stand', () => {
    const report = composeReviewReport(
      { summary: 'Everything looks great, approving!', findings: [finding()] },
      SHA,
    );
    expect(report.status).toBe('FIX_REQUIRED');
  });

  it('always records the commit the studio sent, not one the draft names', () => {
    const report = composeReviewReport(
      { summary: 'Reviewed a different commit deadbeef.', findings: [] },
      SHA,
    );
    expect(report.candidateSha).toBe(SHA);
  });
});
