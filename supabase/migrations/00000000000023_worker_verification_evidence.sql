create or replace function public.record_local_worker_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is null
    or old.completed_at is not null
    or jsonb_typeof(new.result_json -> 'verification') <> 'array' then
    return new;
  end if;

  insert into public.verification_runs (
    organization_id,
    task_id,
    kind,
    command_or_check,
    status,
    duration_ms
  )
  select
    task.organization_id,
    new.task_id,
    case
      when evidence.value ->> 'kind' in (
        'FORMAT', 'LINT', 'TYPECHECK', 'UNIT', 'INTEGRATION', 'E2E', 'SECURITY', 'BUILD'
      ) then evidence.value ->> 'kind'
      else 'INTEGRATION'
    end,
    left(coalesce(nullif(evidence.value ->> 'command', ''), 'worker verification'), 1000),
    case when evidence.value ->> 'status' = 'PASS' then 'PASS' else 'FAIL' end,
    case
      when coalesce(evidence.value ->> 'durationMs', '') ~ '^[0-9]+$'
        then least((evidence.value ->> 'durationMs')::bigint, 1200000)
      else 0
    end
  from public.tasks task
  cross join lateral jsonb_array_elements(new.result_json -> 'verification') evidence(value)
  where task.id = new.task_id;

  return new;
end;
$$;

revoke execute on function public.record_local_worker_verification()
  from public, authenticated, anon;

drop trigger if exists record_local_worker_verification on public.local_worker_leases;
create trigger record_local_worker_verification
after update of completed_at, result_json on public.local_worker_leases
for each row execute function public.record_local_worker_verification();
