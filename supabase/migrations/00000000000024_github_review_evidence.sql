alter table public.tasks
  add column if not exists candidate_pr_number bigint,
  add column if not exists candidate_pr_url text,
  add column if not exists candidate_pr_state text,
  add column if not exists candidate_pr_head_sha text,
  add column if not exists candidate_ci_status text,
  add column if not exists candidate_ci_checked_at timestamptz;

alter table public.tasks
  drop constraint if exists tasks_candidate_pr_number_check,
  add constraint tasks_candidate_pr_number_check
    check (candidate_pr_number is null or candidate_pr_number > 0),
  drop constraint if exists tasks_candidate_pr_state_check,
  add constraint tasks_candidate_pr_state_check
    check (candidate_pr_state is null or candidate_pr_state in ('OPEN', 'CLOSED')),
  drop constraint if exists tasks_candidate_ci_status_check,
  add constraint tasks_candidate_ci_status_check
    check (candidate_ci_status is null or candidate_ci_status in ('PASS', 'FAIL', 'PENDING'));

alter table public.verification_runs
  add column if not exists external_key text;

create unique index if not exists verification_runs_external_key_unique
  on public.verification_runs(task_id, external_key);

create or replace function public.record_local_worker_github_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ci jsonb;
  pull_request jsonb;
  commit_sha text;
begin
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;

  ci := case
    when jsonb_typeof(new.result_json -> 'ci') = 'object' then new.result_json -> 'ci'
    else '{}'::jsonb
  end;
  pull_request := case
    when jsonb_typeof(new.result_json -> 'pullRequest') = 'object'
      then new.result_json -> 'pullRequest'
    else '{}'::jsonb
  end;
  commit_sha := nullif(coalesce(ci ->> 'commitSha', new.result_json ->> 'candidateCommitSha'), '');

  update public.tasks
  set candidate_branch = coalesce(
        nullif(new.result_json ->> 'branch', ''),
        candidate_branch
      ),
      candidate_commit_sha = coalesce(
        nullif(new.result_json ->> 'candidateCommitSha', ''),
        candidate_commit_sha
      ),
      candidate_pr_number = case
        when coalesce(pull_request ->> 'number', '') ~ '^[1-9][0-9]*$'
          then (pull_request ->> 'number')::bigint
        else candidate_pr_number
      end,
      candidate_pr_url = coalesce(nullif(pull_request ->> 'url', ''), candidate_pr_url),
      candidate_pr_state = case
        when pull_request ->> 'state' in ('OPEN', 'CLOSED') then pull_request ->> 'state'
        else candidate_pr_state
      end,
      candidate_pr_head_sha = coalesce(
        nullif(pull_request ->> 'headSha', ''),
        candidate_pr_head_sha
      ),
      candidate_ci_status = case
        when ci ->> 'status' in ('PASS', 'FAIL', 'PENDING') then ci ->> 'status'
        else candidate_ci_status
      end,
      candidate_ci_checked_at = case
        when ci ->> 'status' in ('PASS', 'FAIL', 'PENDING') then now()
        else candidate_ci_checked_at
      end
  where id = new.task_id;

  if commit_sha is not null and jsonb_typeof(ci -> 'checks') = 'array' then
    insert into public.verification_runs (
      organization_id,
      task_id,
      kind,
      command_or_check,
      status,
      duration_ms,
      external_key
    )
    select
      task.organization_id,
      new.task_id,
      'INTEGRATION',
      left(
        'GitHub CI: ' || coalesce(nullif(check_item.value ->> 'name', ''), 'unnamed check'),
        1000
      ),
      case
        when check_item.value ->> 'status' <> 'COMPLETED' then 'PENDING'
        when upper(coalesce(check_item.value ->> 'conclusion', '')) in (
          'SUCCESS', 'SKIPPED', 'NEUTRAL'
        ) then 'PASS'
        else 'FAIL'
      end,
      0,
      'github:' || commit_sha || ':' || encode(
        extensions.digest(
          coalesce(check_item.value ->> 'source', 'CHECK_RUN') || ':' ||
          coalesce(check_item.value ->> 'name', 'unnamed'),
          'sha256'
        ),
        'hex'
      )
    from public.tasks task
    cross join lateral jsonb_array_elements(ci -> 'checks') with ordinality check_item(value, ordinal)
    where task.id = new.task_id and check_item.ordinal <= 200
    on conflict (task_id, external_key)
    do update set
      status = excluded.status,
      command_or_check = excluded.command_or_check,
      executed_at = now();

    if jsonb_array_length(ci -> 'checks') = 0 then
      insert into public.verification_runs (
        organization_id,
        task_id,
        kind,
        command_or_check,
        status,
        duration_ms,
        external_key
      )
      select
        task.organization_id,
        new.task_id,
        'INTEGRATION',
        'GitHub CI: waiting for checks',
        'PENDING',
        0,
        'github:' || commit_sha || ':discovery'
      from public.tasks task
      where task.id = new.task_id
      on conflict (task_id, external_key)
      do update set status = 'PENDING', executed_at = now();
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.record_local_worker_github_review()
  from public, authenticated, anon;

drop trigger if exists record_local_worker_github_review on public.local_worker_leases;
create trigger record_local_worker_github_review
after update of completed_at, result_json on public.local_worker_leases
for each row execute function public.record_local_worker_github_review();
