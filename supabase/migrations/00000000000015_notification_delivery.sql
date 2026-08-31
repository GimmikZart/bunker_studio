alter table public.notifications
  add column if not exists push_dispatched_at timestamptz,
  add column if not exists push_attempts int not null default 0,
  add column if not exists push_next_attempt_at timestamptz not null default now();

create index if not exists notifications_push_pending_idx
  on public.notifications(push_next_attempt_at)
  where push_dispatched_at is null;
