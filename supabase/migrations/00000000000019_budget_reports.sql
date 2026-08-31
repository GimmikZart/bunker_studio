create table if not exists public.budget_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid not null references public.report_schedules(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  total numeric not null check (total >= 0),
  by_provider_json jsonb not null default '{}',
  generated_at timestamptz not null default now(),
  unique (schedule_id, period_start, period_end),
  check (period_end >= period_start),
  check (jsonb_typeof(by_provider_json) = 'object')
);

alter table public.budget_reports enable row level security;
drop policy if exists budget_report_tenant_isolation on public.budget_reports;
create policy budget_report_tenant_isolation on public.budget_reports
  for all using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

create index if not exists budget_reports_organization_generated_idx
  on public.budget_reports(organization_id, generated_at desc);

drop trigger if exists append_domain_event on public.budget_reports;
create trigger append_domain_event after insert or update or delete on public.budget_reports
  for each row execute function public.append_domain_event();
