import {
  nextWeeklyReportAt,
  weeklyCostReport,
  type CostEntry,
  type WeeklyCostReport,
} from '@bunker-studio/core';

export type DueReportSchedule = {
  id: string;
  organizationId: string;
  dayOfWeek: number;
  hourUtc: number;
  minuteUtc: number;
  nextRunAt: string;
};

export type GeneratedWeeklyReport = WeeklyCostReport & {
  scheduleId: string;
  organizationId: string;
  generatedAt: string;
};

export type WeeklyReportSource = {
  listDueSchedules: (now: Date) => Promise<DueReportSchedule[]>;
  listCosts: (organizationId: string) => Promise<CostEntry[]>;
  persistReport: (report: GeneratedWeeklyReport) => Promise<'CREATED' | 'DUPLICATE'>;
  markProcessed: (input: {
    scheduleId: string;
    expectedNextRunAt: string;
    nextRunAt: string;
    lastRunAt: string;
  }) => Promise<void>;
};

export async function dispatchDueWeeklyReports(
  source: WeeklyReportSource,
  now = new Date(),
): Promise<{ generated: number; duplicates: number; failed: number }> {
  const result = { generated: 0, duplicates: 0, failed: 0 };
  for (const schedule of await source.listDueSchedules(now)) {
    try {
      const periodEnd = new Date(schedule.nextRunAt);
      if (Number.isNaN(periodEnd.getTime()) || periodEnd.getTime() > now.getTime()) {
        result.failed += 1;
        continue;
      }
      const report: GeneratedWeeklyReport = {
        ...weeklyCostReport(await source.listCosts(schedule.organizationId), periodEnd),
        scheduleId: schedule.id,
        organizationId: schedule.organizationId,
        generatedAt: now.toISOString(),
      };
      const persisted = await source.persistReport(report);
      if (persisted === 'CREATED') result.generated += 1;
      else result.duplicates += 1;
      await source.markProcessed({
        scheduleId: schedule.id,
        expectedNextRunAt: schedule.nextRunAt,
        nextRunAt: nextWeeklyReportAt(schedule, now).toISOString(),
        lastRunAt: periodEnd.toISOString(),
      });
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
