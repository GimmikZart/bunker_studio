alter table public.tasks
  add column if not exists required_capability text;

create index if not exists tasks_local_worker_claim_idx
  on public.tasks(state, priority desc, created_at);

create table if not exists public.local_worker_leases (
  id uuid primary key default gen_random_uuid(),
  worker_node_id uuid not null references public.worker_nodes(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  attempt_number int not null check (attempt_number > 0),
  status text not null check (status in ('ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED')),
  lease_expires_at timestamptz not null,
  result_json jsonb not null default '{}',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists local_worker_one_active_task
  on public.local_worker_leases(task_id)
  where status = 'ACTIVE';

create index if not exists local_worker_leases_expiry_idx
  on public.local_worker_leases(lease_expires_at)
  where status = 'ACTIVE';

alter table public.local_worker_leases enable row level security;
create policy local_worker_leases_service_role_only on public.local_worker_leases
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.claim_local_worker_task(
  p_node_id uuid,
  p_credential_hash text,
  p_lease_seconds int default 120
)
returns table (
  authenticated boolean,
  lease_id uuid,
  task_id uuid,
  organization_id uuid,
  project_id uuid,
  title text,
  description text,
  task_type text,
  task_state public.task_state,
  read_scope_json jsonb,
  write_scope_json jsonb,
  definition_of_done_json jsonb,
  required_capability text,
  attempt_number int,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  worker public.worker_nodes%rowtype;
  task public.tasks%rowtype;
  lease uuid;
  expired record;
  expires_at timestamptz;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'INVALID_WORKER_LEASE';
  end if;

  for expired in
    select expired_lease.worker_node_id, count(*)::int as lease_count
    from public.local_worker_leases expired_lease
    where expired_lease.status = 'ACTIVE' and expired_lease.lease_expires_at <= now()
    group by expired_lease.worker_node_id
  loop
    update public.tasks task_row
    set state = 'QUEUED', completed_at = null
    where task_row.state = 'RUNNING'
      and exists (
        select 1
        from public.local_worker_leases expired_lease
        where expired_lease.task_id = task_row.id
          and expired_lease.worker_node_id = expired.worker_node_id
          and expired_lease.status = 'ACTIVE'
          and expired_lease.lease_expires_at <= now()
      );
    update public.local_worker_leases expired_lease
    set status = 'EXPIRED', completed_at = now(), error_message = 'Lease expired.'
    where expired_lease.worker_node_id = expired.worker_node_id
      and expired_lease.status = 'ACTIVE'
      and expired_lease.lease_expires_at <= now();
    update public.worker_nodes
    set active_jobs = greatest(0, active_jobs - expired.lease_count)
    where id = expired.worker_node_id;
  end loop;

  select * into worker
  from public.worker_nodes
  where id = p_node_id
    and credential_hash = p_credential_hash
    and revoked_at is null
  for update;
  if not found then
    return query select false, null::uuid, null::uuid, null::uuid, null::uuid, null::text,
      null::text, null::text, null::public.task_state, null::jsonb, null::jsonb, null::jsonb,
      null::text, null::int, null::timestamptz;
    return;
  end if;
  if worker.status <> 'ONLINE' or worker.active_jobs >= worker.max_concurrent then
    return query select true, null::uuid, null::uuid, null::uuid, null::uuid, null::text,
      null::text, null::text, null::public.task_state, null::jsonb, null::jsonb, null::jsonb,
      null::text, null::int, null::timestamptz;
    return;
  end if;
  if worker.last_heartbeat_at is null or worker.last_heartbeat_at < now() - interval '5 minutes' then
    return query select true, null::uuid, null::uuid, null::uuid, null::uuid, null::text,
      null::text, null::text, null::public.task_state, null::jsonb, null::jsonb, null::jsonb,
      null::text, null::int, null::timestamptz;
    return;
  end if;

  select candidate.* into task
  from public.tasks candidate
  where candidate.state = 'QUEUED'
    and not exists (
      select 1 from public.local_worker_leases active_lease
      where active_lease.task_id = candidate.id and active_lease.status = 'ACTIVE'
    )
    and (
      candidate.required_capability is null
      or coalesce(worker.capabilities_json -> 'items', '[]'::jsonb) ? candidate.required_capability
    )
    and not exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(candidate.read_scope_json, '[]'::jsonb) || coalesce(candidate.write_scope_json, '[]'::jsonb)
      ) requested
      where not exists (
        select 1
        from jsonb_array_elements_text(coalesce(worker.allowed_scopes_json -> 'items', '[]'::jsonb)) allowed
        where length(trim(replace(requested.value, chr(92), '/'))) > 0
          and (
            regexp_replace(trim(replace(requested.value, chr(92), '/')), '^/+', '') =
              regexp_replace(trim(replace(allowed.value, chr(92), '/')), '^/+', '')
            or regexp_replace(trim(replace(requested.value, chr(92), '/')), '^/+', '') like
              regexp_replace(trim(replace(allowed.value, chr(92), '/')), '^/+', '') || '/%'
          )
      )
    )
    and not exists (
      select 1
      from public.task_dependencies dependency
      join public.tasks prerequisite on prerequisite.id = dependency.depends_on_task_id
      where dependency.task_id = candidate.id
        and prerequisite.state <> 'DONE'
    )
  order by candidate.priority desc, candidate.created_at, candidate.id
  for update skip locked
  limit 1;
  if not found then
    return query select true, null::uuid, null::uuid, null::uuid, null::uuid, null::text,
      null::text, null::text, null::public.task_state, null::jsonb, null::jsonb, null::jsonb,
      null::text, null::int, null::timestamptz;
    return;
  end if;

  update public.tasks
  set state = 'RUNNING', started_at = coalesce(started_at, now())
  where id = task.id;

  expires_at := now() + make_interval(secs => p_lease_seconds);
  insert into public.local_worker_leases (
    worker_node_id, task_id, attempt_number, status, lease_expires_at
  ) values (
    worker.id, task.id, task.retry_count + 1, 'ACTIVE', expires_at
  ) returning id into lease;

  update public.worker_nodes
  set active_jobs = active_jobs + 1
  where id = worker.id;

  return query
  select true, lease, task.id, task.organization_id, task.project_id, task.title,
    task.description, task.task_type, task.state, task.read_scope_json,
    task.write_scope_json, task.definition_of_done_json, task.required_capability,
    task.retry_count + 1, expires_at;
end;
$$;

revoke execute on function public.claim_local_worker_task(uuid, text, int)
  from public, authenticated, anon;
grant execute on function public.claim_local_worker_task(uuid, text, int)
  to service_role;

create or replace function public.complete_local_worker_task(
  p_lease_id uuid,
  p_node_id uuid,
  p_credential_hash text,
  p_success boolean,
  p_result jsonb default '{}',
  p_error text default null
)
returns table (
  authenticated boolean,
  completed boolean,
  task_id uuid,
  task_state public.task_state,
  retry_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  worker public.worker_nodes%rowtype;
  lease public.local_worker_leases%rowtype;
  resulting_state public.task_state;
  resulting_retry_count int;
begin
  select * into worker
  from public.worker_nodes
  where id = p_node_id
    and credential_hash = p_credential_hash
    and revoked_at is null
  for update;
  if not found then
    return query select false, false, null::uuid, null::public.task_state, null::int;
    return;
  end if;

  select * into lease
  from public.local_worker_leases
  where id = p_lease_id and worker_node_id = worker.id and status = 'ACTIVE'
  for update;
  if not found then
    return query select true, false, null::uuid, null::public.task_state, null::int;
    return;
  end if;

  if p_success then
    resulting_state := 'IMPLEMENTED';
  else
    select case when task_row.retry_count < task_row.max_retries then 'QUEUED'::public.task_state
      else 'FAILED_FINAL'::public.task_state end,
      case when task_row.retry_count < task_row.max_retries then task_row.retry_count + 1
        else task_row.retry_count end
    into resulting_state, resulting_retry_count
    from public.tasks task_row
    where task_row.id = lease.task_id and task_row.state = 'RUNNING'
    for update;
    if not found then
      return query select true, false, null::uuid, null::public.task_state, null::int;
      return;
    end if;
  end if;

  if p_success then
    update public.tasks task_row
    set state = resulting_state, completed_at = now()
    where task_row.id = lease.task_id and task_row.state = 'RUNNING'
    returning task_row.retry_count into resulting_retry_count;
  else
    update public.tasks
    set state = resulting_state, retry_count = resulting_retry_count,
      completed_at = case when resulting_state = 'FAILED_FINAL' then now() else null end
    where id = lease.task_id;
  end if;
  if not found then
    return query select true, false, null::uuid, null::public.task_state, null::int;
    return;
  end if;

  update public.local_worker_leases
  set status = case when p_success then 'COMPLETED' else 'FAILED' end,
    result_json = coalesce(p_result, '{}'::jsonb), error_message = p_error,
    completed_at = now()
  where id = lease.id;
  update public.worker_nodes
  set active_jobs = greatest(0, active_jobs - 1)
  where id = worker.id;

  return query select true, true, lease.task_id, resulting_state, resulting_retry_count;
end;
$$;

revoke execute on function public.complete_local_worker_task(uuid, uuid, text, boolean, jsonb, text)
  from public, authenticated, anon;
grant execute on function public.complete_local_worker_task(uuid, uuid, text, boolean, jsonb, text)
  to service_role;
