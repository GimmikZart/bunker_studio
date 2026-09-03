import {
  meetingMinutesProposalSchema,
  type MeetingMinutesProposal,
} from '@bunker-studio/contracts';
import type { MeetingContribution } from './index.js';

/**
 * Prompts and parsing for a meeting run.  A meeting is a workflow, not a shared
 * unbounded chat: every participant sees the agenda plus a distilled digest of
 * what was already said, never the raw transcript, so a longer meeting does not
 * cost more per round.
 */

export const MAX_MEETING_RESPONSE_CHARACTERS = 40_000;

const MAX_AGENDA_ITEMS = 20;
const MAX_AGENDA_ITEM_CHARACTERS = 300;
const MAX_TITLE_CHARACTERS = 200;

function boundedAgenda(agenda: string[]): string[] {
  return agenda
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, MAX_AGENDA_ITEMS)
    .map((item) => item.slice(0, MAX_AGENDA_ITEM_CHARACTERS));
}

function renderAgenda(agenda: string[]): string {
  const items = boundedAgenda(agenda);
  if (!items.length) return 'Agenda:\n- none recorded';
  return `Agenda:\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;
}

export function buildMeetingContributionPrompt(input: {
  agentTitle: string;
  meetingTitle: string;
  agenda: string[];
  round: number;
  boundedContext: string;
}): string {
  const opening =
    input.round === 1
      ? 'You are speaking first, so state your position on the agenda from your role.'
      : 'Respond to what your colleagues said: agree, disagree with a reason, or add what is missing.';
  return [
    `You are the ${input.agentTitle} in the meeting "${input.meetingTitle.slice(0, MAX_TITLE_CHARACTERS)}".`,
    '',
    renderAgenda(input.agenda),
    '',
    input.boundedContext
      ? `What has been said so far (digest):\n${input.boundedContext}`
      : 'Nothing has been said yet.',
    '',
    `This is round ${input.round}. ${opening}`,
    'Answer in plain prose, at most 200 words. Do not restate the agenda.',
    'Speak only to what your role is accountable for.',
  ].join('\n');
}

export function buildMeetingMinutesPrompt(input: {
  meetingTitle: string;
  agenda: string[];
  contributions: MeetingContribution[];
  participantAgentIds: string[];
}): string {
  const transcript = input.contributions
    .map((item) => `[${item.agentId} / round ${item.round}] ${item.content}`)
    .join('\n');
  return [
    `You are the Lead closing the meeting "${input.meetingTitle.slice(0, MAX_TITLE_CHARACTERS)}".`,
    '',
    renderAgenda(input.agenda),
    '',
    `Contributions:\n${transcript}`,
    '',
    'Write the minutes. Record only decisions actually supported by the contributions above;',
    'if the participants did not settle a point, leave it out rather than inventing an outcome.',
    `An action item owner, when named, must be one of these agent ids: ${input.participantAgentIds.join(', ')}.`,
    '',
    'Answer with a single JSON object and no prose, matching exactly:',
    '{"summary":string,"decisions":[{"title":string,"decision":string}],',
    '"actionItems":[{"title":string,"ownerAgentId"?:string}]}',
  ].join('\n');
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

export type MeetingMinutesOutcome =
  { ok: true; minutes: MeetingMinutesProposal } | { ok: false; reason: string };

/**
 * Validates drafted minutes deterministically.  Action items may only be
 * assigned to agents that actually attended, so a model cannot create work for
 * someone who was not in the room.
 */
export function parseMeetingMinutes(
  text: string,
  participantAgentIds: string[],
): MeetingMinutesOutcome {
  if (text.length > MAX_MEETING_RESPONSE_CHARACTERS)
    return { ok: false, reason: 'The minutes response exceeded the accepted size.' };
  const json = extractJsonObject(text);
  if (!json) return { ok: false, reason: 'The minutes response did not contain a JSON object.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'The minutes response was not valid JSON.' };
  }
  const result = meetingMinutesProposalSchema.safeParse(parsed);
  if (!result.success) return { ok: false, reason: 'The minutes did not match the agreed shape.' };
  const participants = new Set(participantAgentIds);
  if (
    result.data.actionItems.some(
      (item) => item.ownerAgentId && !participants.has(item.ownerAgentId),
    )
  )
    return { ok: false, reason: 'An action item was assigned to an agent that did not attend.' };
  return { ok: true, minutes: result.data };
}

/**
 * Deterministic minutes used when the Lead cannot draft them or its draft is
 * rejected.  Recording no decisions is correct here: the meeting happened and
 * the contributions are preserved, but nothing was agreed that we can prove.
 */
export function fallbackMeetingMinutes(distilledContext: string): MeetingMinutesProposal {
  return {
    summary: distilledContext.slice(0, 4_000) || 'No contributions were recorded.',
    decisions: [],
    actionItems: [],
  };
}
