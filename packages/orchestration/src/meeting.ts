import { distillMeetingContext, type MeetingContribution } from './index.js';

export type MeetingAgent = (
  agentId: string,
  round: number,
  boundedContext: string,
) => Promise<string> | string;

export type BoundedMeetingResult = {
  contributions: MeetingContribution[];
  distilledContext: string;
  roundsUsed: number;
};

export async function runBoundedMeeting(input: {
  agentIds: string[];
  maxRounds: number;
  contribute: MeetingAgent;
  shouldContinue?: (contributions: MeetingContribution[]) => boolean;
  maxContextChars?: number;
}): Promise<BoundedMeetingResult> {
  const maxRounds = Math.max(1, Math.min(input.maxRounds, 3));
  const contributions: MeetingContribution[] = [];
  let context = '';
  for (let round = 1; round <= maxRounds; round += 1) {
    const results = await Promise.all(
      input.agentIds.map(async (agentId) => ({
        agentId,
        round,
        content: await input.contribute(agentId, round, context),
      })),
    );
    contributions.push(...results);
    context = distillMeetingContext(contributions, input.maxContextChars ?? 2_000);
    if (!(input.shouldContinue?.(contributions) ?? false)) break;
  }
  return {
    contributions,
    distilledContext: context,
    roundsUsed: Math.max(...contributions.map((item) => item.round), 0),
  };
}
