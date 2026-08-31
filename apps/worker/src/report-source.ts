import type { SupabaseClient } from '@supabase/supabase-js';
import type { CostEntry } from '@bunker-studio/core';
import type { GeneratedWeeklyReport, WeeklyReportSource } from './report-scheduler.js';

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object'),
      )
    : [];
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${field}.`);
  return value;
}

function numberValue(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field}.`);
  return parsed;
}

function mapSchedule(value: unknown) {
  const item = value as Record<string, unknown>;
  return {
    id: stringValue(item.id, 'schedule id'),
    organizationId: stringValue(item.organization_id, 'organization id'),
    dayOfWeek: numberValue(item.day_of_week, 'day of week'),
    hourUtc: numberValue(item.hour_utc, 'hour'),
    minuteUtc: numberValue(item.minute_utc, 'minute'),
    nextRunAt: stringValue(item.next_run_at, 'next run'),
  };
}

function mapCost(value: unknown): CostEntry {
  const item = value as Record<string, unknown>;
  return {
    amount: numberValue(item.amount, 'amount'),
    occurredAt: stringValue(item.occurred_at, 'occurred at'),
    provider: stringValue(item.provider_type, 'provider'),
    model: stringValue(item.provider_model_id, 'model'),
    projectId: typeof item.project_id === 'string' ? item.project_id : undefined,
    taskId: typeof item.task_id === 'string' ? item.task_id : undefined,
    agentId: typeof item.agent_id === 'string' ? item.agent_id : undefined,
    runId: typeof item.run_id === 'string' ? item.run_id : undefined,
  };
}

export function createSupabaseReportSource(client: SupabaseClient): WeeklyReportSource {
  return {
    async listDueSchedules(now) {
      const result = await client
        .from('report_schedules')
        .select('id,organization_id,day_of_week,hour_utc,minute_utc,next_run_at')
        .eq('enabled', true)
        .lte('next_run_at', now.toISOString())
        .order('next_run_at', { ascending: true })
        .limit(100);
      if (result.error) throw new Error(result.error.message);
      return rows(result.data).map(mapSchedule);
    },
    async listCosts(organizationId) {
      const result = await client
        .from('cost_ledger')
        .select(
          'amount,occurred_at,provider_type,provider_model_id,project_id,task_id,agent_id,run_id',
        )
        .eq('organization_id', organizationId);
      if (result.error) throw new Error(result.error.message);
      return rows(result.data).map(mapCost);
    },
    async persistReport(report: GeneratedWeeklyReport) {
      const result = await client
        .from('budget_reports')
        .insert({
          organization_id: report.organizationId,
          schedule_id: report.scheduleId,
          period_start: report.periodStart,
          period_end: report.periodEnd,
          total: report.total,
          by_provider_json: report.byProvider,
          generated_at: report.generatedAt,
        })
        .select('id')
        .maybeSingle();
      if (!result.error) return 'CREATED';
      if (result.error.code === '23505') return 'DUPLICATE';
      throw new Error(result.error.message);
    },
    async markProcessed({ scheduleId, expectedNextRunAt, nextRunAt, lastRunAt }) {
      const result = await client
        .from('report_schedules')
        .update({ next_run_at: nextRunAt, last_run_at: lastRunAt })
        .eq('id', scheduleId)
        .eq('next_run_at', expectedNextRunAt);
      if (result.error) throw new Error(result.error.message);
    },
  };
}
