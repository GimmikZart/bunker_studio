import { DEFAULT_PLAYBOOK_KEY, findPlaybook, playbookCatalogue } from './playbooks.js';

/**
 * The conversation in which the Lead works out what is actually wanted.
 *
 * It answers in structure, not prose, for one reason: the studio has to know
 * whether there are still open questions, and it must not learn that by reading
 * a paragraph. What the Lead may never do is decide the conversation is
 * finished — `readyForApproval` is a suggestion shown to the user, and the
 * stage closes when the user approves it and not before.
 */

export const MAX_ENGAGEMENT_RESPONSE_CHARACTERS = 40_000;
const MAX_TURNS_IN_PROMPT = 12;
const MAX_TURN_CHARACTERS = 1_500;
const MAX_QUESTIONS = 6;

export type EngagementTurn = { role: 'USER' | 'LEAD'; content: string };

export type EngagementBrief = {
  /** What the Lead still needs answered. Empty means it believes it has enough. */
  questions: string[];
  /** What it understands the work to be, in its own words. */
  understanding: string;
  /** Decisions the user has not made yet. */
  openPoints: string[];
  /** What is in scope, stated so it can be argued with. */
  proposedScope: string[];
  /** What is deliberately not in scope. */
  outOfScope: string[];
  /** Which way of working it thinks this is. Validated against the catalogue. */
  playbookKey: string;
  /** Its own opinion that the brief is ready. Never advances anything by itself. */
  readyForApproval: boolean;
};

export type EngagementOutcome =
  { ok: true; brief: EngagementBrief; correctedPlaybook: boolean } | { ok: false; reason: string };

export function buildEngagementPrompt(input: {
  agentTitle: string;
  projectName: string;
  repository: string | null;
  turns: EngagementTurn[];
  message: string;
}): string {
  // Only the recent exchange is replayed. A brief that grows by one turn each
  // time would make the last question of a long conversation cost the most.
  const recent = input.turns
    .slice(-MAX_TURNS_IN_PROMPT)
    .map(
      (turn) =>
        `${turn.role === 'USER' ? 'User' : 'You'}: ${turn.content.slice(0, MAX_TURN_CHARACTERS)}`,
    )
    .join('\n');
  return [
    `You are the Lead Architect of a software studio, working as ${input.agentTitle}.`,
    'Your job in this conversation is to understand what the user actually needs, well enough that the work can be planned without guessing.',
    '',
    `Project: ${input.projectName}`,
    input.repository ? `Repository: ${input.repository}` : 'No repository is connected yet.',
    '',
    recent ? `The conversation so far:\n${recent}` : 'This is the first message.',
    '',
    `The user now says:\n${input.message.slice(0, 4_000)}`,
    '',
    'Ways of working you may choose from:',
    playbookCatalogue(),
    '',
    'Rules:',
    `- Ask at most ${MAX_QUESTIONS} questions, and only ones whose answer would change the work.`,
    '- Ask nothing you can reasonably infer, and never re-ask what has been answered.',
    '- State your understanding plainly enough that the user can tell you that you are wrong.',
    '- Set readyForApproval to true only when no question of yours is unanswered.',
    '- Choose the playbookKey that fits what the user described, from the list above.',
    '',
    'Answer with a single JSON object and no prose, matching exactly:',
    '{"questions":string[],"understanding":string,"openPoints":string[],',
    '"proposedScope":string[],"outOfScope":string[],"playbookKey":string,"readyForApproval":boolean}',
  ].join('\n');
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]!;
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

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Reads the Lead's answer, refusing anything that is not the agreed shape.
 *
 * A playbook key the studio does not have is corrected to the default rather
 * than rejected: the conversation is worth more than the label, and the
 * substitution is reported so nobody is told a choice was honoured when it was
 * not.
 */
export function parseEngagementReply(text: string): EngagementOutcome {
  if (text.length > MAX_ENGAGEMENT_RESPONSE_CHARACTERS)
    return { ok: false, reason: 'The Lead answered with more text than the studio will read.' };
  const json = extractJsonObject(text);
  if (!json) return { ok: false, reason: 'The Lead did not answer with a structured brief.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'The Lead answered with a brief that is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object')
    return { ok: false, reason: 'The Lead answered with a brief that is not an object.' };
  const record = parsed as Record<string, unknown>;
  const understanding = typeof record.understanding === 'string' ? record.understanding.trim() : '';
  if (!understanding)
    return { ok: false, reason: 'The Lead did not say what it understands the work to be.' };

  const requested = typeof record.playbookKey === 'string' ? record.playbookKey.trim() : '';
  const known = Boolean(findPlaybook(requested));
  const questions = stringList(record.questions, MAX_QUESTIONS);
  return {
    ok: true,
    correctedPlaybook: !known,
    brief: {
      questions,
      understanding,
      openPoints: stringList(record.openPoints, 10),
      proposedScope: stringList(record.proposedScope, 20),
      outOfScope: stringList(record.outOfScope, 20),
      playbookKey: known ? requested : DEFAULT_PLAYBOOK_KEY,
      // Its own claim is not enough: an unanswered question is an unanswered
      // question, whatever the Lead says about being ready.
      readyForApproval: record.readyForApproval === true && questions.length === 0,
    },
  };
}
