import { reviewOutcome, type ReviewFinding as CoreReviewFinding } from '@bunker-studio/core';

export type ReviewFinding = CoreReviewFinding & { title: string };

export type ReviewCycleResult = {
  cycle: number;
  findings: ReviewFinding[];
  outcome: 'PASS' | 'FIX_REQUIRED';
};

export type ReviewLoopResult = {
  status: 'DONE' | 'BLOCKED';
  cycles: ReviewCycleResult[];
  fixTaskTitles: string[];
};

export async function runReviewFixLoop(input: {
  maxCycles?: number;
  review: (cycle: number) => Promise<ReviewFinding[]> | ReviewFinding[];
  applyFixes: (findings: ReviewFinding[], cycle: number) => Promise<void> | void;
}): Promise<ReviewLoopResult> {
  const maxCycles = Math.max(1, input.maxCycles ?? 3);
  const cycles: ReviewCycleResult[] = [];
  const fixTaskTitles: string[] = [];
  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    const findings = await input.review(cycle);
    const outcome = reviewOutcome(findings);
    cycles.push({ cycle, findings, outcome });
    if (outcome === 'PASS') return { status: 'DONE', cycles, fixTaskTitles };
    for (const finding of findings.filter((item) => item.blocking))
      fixTaskTitles.push(`Fix review finding: ${finding.title}`);
    await input.applyFixes(findings, cycle);
  }
  return { status: 'BLOCKED', cycles, fixTaskTitles };
}
