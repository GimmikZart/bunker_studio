import {
  reviewDraftSchema,
  type ReviewDraft,
  type ReviewFinding,
  type VerificationEvidence,
} from '@bunker-studio/contracts';
import { reviewOutcome } from '@bunker-studio/core';

/**
 * Prompt and parsing for a Reviewer agent.
 *
 * The Reviewer reports findings; it does not decide whether the candidate
 * passes. The outcome is derived from the findings, and the reviewed commit is
 * the one the studio asked about, so a model cannot wave a candidate through by
 * claiming success or by reviewing a different commit.
 */

export const MAX_REVIEW_RESPONSE_CHARACTERS = 120_000;
/** Diff budget for one review, so a large candidate cannot inflate cost without bound. */
export const MAX_REVIEW_DIFF_CHARACTERS = 60_000;

const MAX_FILES = 60;
const MAX_DEFINITION_OF_DONE = 20;
const MAX_ITEM_CHARACTERS = 300;

export type ReviewFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

/**
 * Renders the candidate diff within a fixed character budget, keeping whole
 * files where possible and stating plainly what was left out. Silently
 * truncating would let the Reviewer report on code it never saw.
 */
export function renderReviewDiff(
  files: ReviewFile[],
  maxCharacters = MAX_REVIEW_DIFF_CHARACTERS,
): string {
  const considered = files.slice(0, MAX_FILES);
  const omittedFiles = files.length - considered.length;
  const rendered: string[] = [];
  let used = 0;
  let truncated = 0;
  for (const file of considered) {
    const header = `--- ${file.filename} (${file.status}, +${file.additions} -${file.deletions})`;
    const patch = file.patch ?? '(no textual patch available)';
    const block = `${header}\n${patch}`;
    if (used + block.length > maxCharacters) {
      truncated += 1;
      continue;
    }
    rendered.push(block);
    used += block.length;
  }
  const notes: string[] = [];
  if (omittedFiles > 0) notes.push(`${omittedFiles} further file(s) were not included.`);
  if (truncated > 0) notes.push(`${truncated} file(s) exceeded the diff budget and were omitted.`);
  if (!rendered.length && !notes.length) return 'The candidate contains no textual changes.';
  return [...rendered, ...(notes.length ? [`NOTE: ${notes.join(' ')}`] : [])].join('\n\n');
}

export function buildReviewPrompt(input: {
  reviewerTitle: string;
  taskTitle: string;
  taskDescription: string;
  definitionOfDone: string[];
  candidateCommitSha: string;
  files: ReviewFile[];
  verification: VerificationEvidence[];
}): string {
  const dod = input.definitionOfDone
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, MAX_DEFINITION_OF_DONE)
    .map((item) => item.slice(0, MAX_ITEM_CHARACTERS));
  const verification = input.verification.length
    ? input.verification.map((run) => `- ${run.kind}: ${run.status} (${run.command})`).join('\n')
    : '- no deterministic verification was recorded';
  return [
    `You are the ${input.reviewerTitle} reviewing one candidate change.`,
    '',
    `Task: ${input.taskTitle}`,
    input.taskDescription.trim() ? `Description:\n${input.taskDescription.trim()}` : '',
    '',
    dod.length
      ? `Definition of done:\n${dod.map((item) => `- ${item}`).join('\n')}`
      : 'Definition of done: not stated.',
    '',
    `Deterministic verification already run by the studio:\n${verification}`,
    '',
    `Candidate commit: ${input.candidateCommitSha}`,
    '',
    `Diff:\n${renderReviewDiff(input.files)}`,
    '',
    'Report what is wrong with this change. Rules:',
    '- Only report problems you can point at in the diff above; cite the evidence.',
    '- Do not repeat the deterministic verification results as findings.',
    '- Mark a finding blocking only if it must be fixed before this can be merged.',
    '- If the change is sound, return an empty findings array and say so in the summary.',
    '- Do not state whether the review passes. That is decided from your findings.',
    '',
    'Answer with a single JSON object and no prose, matching exactly:',
    '{"summary":string,"findings":[{"severity":"INFO"|"LOW"|"MEDIUM"|"HIGH"|"CRITICAL",',
    '"category":"CORRECTNESS"|"SECURITY"|"PERFORMANCE"|"TEST"|"MAINTAINABILITY"|"SPECIFICATION",',
    '"title":string,"description":string,"evidence":string,"recommendation":string,',
    '"blocking":boolean,"confidence":number,"filePath"?:string,"symbol"?:string}]}',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Extracts the outermost JSON object from a model response, tolerating code
 * fences and surrounding prose without ever evaluating the text.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

export type ReviewDraftOutcome = { ok: true; draft: ReviewDraft } | { ok: false; reason: string };

export function parseReviewDraft(text: string): ReviewDraftOutcome {
  if (text.length > MAX_REVIEW_RESPONSE_CHARACTERS)
    return { ok: false, reason: 'The review response exceeded the accepted size.' };
  const json = extractJsonObject(text);
  if (!json) return { ok: false, reason: 'The review response did not contain a JSON object.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'The review response was not valid JSON.' };
  }
  const result = reviewDraftSchema.safeParse(parsed);
  if (!result.success)
    return { ok: false, reason: 'The review draft did not match the agreed shape.' };
  return { ok: true, draft: result.data };
}

export type ComposedReview = {
  candidateSha: string;
  status: 'PASS' | 'FIX_REQUIRED';
  summary: string;
  findings: ReviewFinding[];
};

/**
 * Builds the persisted review from a Reviewer draft.
 *
 * The commit and the outcome come from the studio, never from the draft: the
 * review is always recorded against the exact commit that was sent for review,
 * and the status follows from the findings.
 */
export function composeReviewReport(draft: ReviewDraft, candidateSha: string): ComposedReview {
  return {
    candidateSha,
    status: reviewOutcome(draft.findings),
    summary: draft.summary,
    findings: draft.findings,
  };
}
