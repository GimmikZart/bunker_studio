alter table public.workflows
  add column if not exists plan_json jsonb not null default '{}';

alter table public.workflows
  add column if not exists task_ids_json jsonb not null default '[]';
