alter table public.tasks
  add column if not exists candidate_branch text,
  add column if not exists worker_result_json jsonb not null default '{}';
