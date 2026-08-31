import { describe, expect, it } from 'vitest';
import { dispatchDueWeeklyReports, type GeneratedWeeklyReport } from './report-scheduler';

describe('weekly report scheduler', () => {
  it('generates a bounded report for a due schedule and advances it', async () => {
    const persisted: GeneratedWeeklyReport[] = [];
    const processed: Array<{ nextRunAt: string; lastRunAt: string }> = [];
    const result = await dispatchDueWeeklyReports(
      {
        async listDueSchedules() {
          return [
            {
              id: 'schedule-1',
              organizationId: 'organization-1',
              dayOfWeek: 1,
              hourUtc: 9,
              minuteUtc: 30,
              nextRunAt: '2026-08-31T09:30:00.000Z',
            },
          ];
        },
        async listCosts() {
          return [
            {
              amount: 2.5,
              occurredAt: '2026-08-30T12:00:00.000Z',
              provider: 'fake',
              model: 'demo',
            },
          ];
        },
        async persistReport(report) {
          persisted.push(report);
          return 'CREATED';
        },
        async markProcessed(input) {
          processed.push({ nextRunAt: input.nextRunAt, lastRunAt: input.lastRunAt });
        },
      },
      new Date('2026-08-31T10:00:00.000Z'),
    );

    expect(result).toEqual({ generated: 1, duplicates: 0, failed: 0 });
    expect(persisted[0]).toMatchObject({
      scheduleId: 'schedule-1',
      organizationId: 'organization-1',
      periodEnd: '2026-08-31T09:30:00.000Z',
      total: 2.5,
      byProvider: { fake: 2.5 },
    });
    expect(processed).toEqual([
      {
        nextRunAt: '2026-09-07T09:30:00.000Z',
        lastRunAt: '2026-08-31T09:30:00.000Z',
      },
    ]);
  });

  it('keeps duplicate delivery idempotent while still advancing the schedule', async () => {
    let markCount = 0;
    const result = await dispatchDueWeeklyReports(
      {
        async listDueSchedules() {
          return [
            {
              id: 'schedule-2',
              organizationId: 'organization-2',
              dayOfWeek: 0,
              hourUtc: 8,
              minuteUtc: 0,
              nextRunAt: '2026-08-30T08:00:00.000Z',
            },
          ];
        },
        async listCosts() {
          return [];
        },
        async persistReport() {
          return 'DUPLICATE';
        },
        async markProcessed() {
          markCount += 1;
        },
      },
      new Date('2026-08-30T08:01:00.000Z'),
    );

    expect(result).toEqual({ generated: 0, duplicates: 1, failed: 0 });
    expect(markCount).toBe(1);
  });
});
