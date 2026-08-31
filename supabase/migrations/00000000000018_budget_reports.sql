alter table public.budget_policies
  add column if not exists escalation_threshold int not null default 2,
  add column if not exists allow_provider_fallback boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.budget_policies
  drop constraint if exists budget_policies_escalation_threshold_check;
alter table public.budget_policies
  add constraint budget_policies_escalation_threshold_check
  check (escalation_threshold between 0 and 100);

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  frequency text not null default 'WEEKLY' check (frequency = 'WEEKLY'),
  day_of_week int not null check (day_of_week between 0 and 6),
  hour_utc int not null check (hour_utc between 0 and 23),
  minute_utc int not null check (minute_utc between 0 and 59),
  timezone text not null default 'UTC',
  recipients_json jsonb not null default '[]',
  check (jsonb_typeof(recipients_json) = 'array'),
  enabled boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table public.report_schedules enable row level security;
drop policy if exists report_schedule_tenant_isolation on public.report_schedules;
create policy report_schedule_tenant_isolation on public.report_schedules
  for all using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

create index if not exists report_schedules_due_idx
  on public.report_schedules(next_run_at)
  where enabled;

drop trigger if exists append_domain_event on public.report_schedules;
create trigger append_domain_event after insert or update or delete on public.report_schedules
  for each row execute function public.append_domain_event();
