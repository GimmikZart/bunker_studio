create or replace function public.renew_local_worker_lease(
  p_lease_id uuid,
  p_node_id uuid,
  p_credential_hash text,
  p_lease_seconds int default 120
)
returns table (
  authenticated boolean,
  renewed boolean,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_exists boolean;
  renewed_until timestamptz;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'INVALID_WORKER_LEASE';
  end if;

  select exists (
    select 1 from public.worker_nodes
    where id = p_node_id
      and credential_hash = p_credential_hash
      and revoked_at is null
  ) into worker_exists;
  if not worker_exists then
    return query select false, false, null::timestamptz;
    return;
  end if;

  update public.local_worker_leases
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where id = p_lease_id
    and worker_node_id = p_node_id
    and status = 'ACTIVE'
    and lease_expires_at > now()
  returning public.local_worker_leases.lease_expires_at into renewed_until;

  return query select true, renewed_until is not null, renewed_until;
end;
$$;

revoke execute on function public.renew_local_worker_lease(uuid, uuid, text, int)
  from public, authenticated, anon;
grant execute on function public.renew_local_worker_lease(uuid, uuid, text, int)
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
  task public.tasks%rowtype;
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
  where id = p_lease_id
    and worker_node_id = worker.id
    and status = 'ACTIVE'
    and lease_expires_at > now()
  for update;
  if not found then
    return query select true, false, null::uuid, null::public.task_state, null::int;
    return;
  end if;

  select * into task
  from public.tasks
  where id = lease.task_id and state = 'RUNNING'
  for update;
  if not found then
    return query select true, false, null::uuid, null::public.task_state, null::int;
    return;
  end if;

  if p_success then
    resulting_state := 'IMPLEMENTED';
    resulting_retry_count := task.retry_count;
  elsif task.retry_count < task.max_retries then
    resulting_state := 'QUEUED';
    resulting_retry_count := task.retry_count + 1;
  else
    resulting_state := 'FAILED_FINAL';
    resulting_retry_count := task.retry_count;
  end if;

  update public.tasks
  set state = resulting_state,
    retry_count = resulting_retry_count,
    completed_at = case when resulting_state in ('IMPLEMENTED', 'FAILED_FINAL') then now() else null end,
    worker_result_json = coalesce(p_result, '{}'::jsonb) ||
      case when p_error is null then '{}'::jsonb else jsonb_build_object('error', p_error) end,
    candidate_commit_sha = case
      when p_success then coalesce(nullif(p_result ->> 'candidateCommitSha', ''), candidate_commit_sha)
      else candidate_commit_sha end,
    candidate_branch = case
      when p_success then coalesce(nullif(p_result ->> 'branch', ''), candidate_branch)
      else candidate_branch end
  where id = task.id;

  update public.local_worker_leases
  set status = case when p_success then 'COMPLETED' else 'FAILED' end,
    result_json = coalesce(p_result, '{}'::jsonb),
    error_message = p_error,
    completed_at = now()
  where id = lease.id;

  update public.worker_nodes
  set active_jobs = greatest(0, active_jobs - 1)
  where id = worker.id;

  if resulting_state in ('IMPLEMENTED', 'FAILED_FINAL') then
    insert into public.notifications (
      organization_id, user_id, category, severity, title, body, deep_link
    )
    select task.organization_id, member.user_id, 'WORKFLOW',
      case when resulting_state = 'FAILED_FINAL' then 'HIGH' else 'LOW' end,
      case when resulting_state = 'FAILED_FINAL' then 'Task failed' else 'Task implementation ready' end,
      case when resulting_state = 'FAILED_FINAL'
        then 'Task "' || task.title || '" exhausted its automatic retries.'
        else 'Task "' || task.title || '" has a candidate implementation ready for verification.' end,
      '/tasks?taskId=' || task.id::text
    from public.organization_members member
    where member.organization_id = task.organization_id
      and member.role in ('OWNER', 'ADMIN');
  end if;

  return query select true, true, task.id, resulting_state, resulting_retry_count;
end;
$$;

revoke execute on function public.complete_local_worker_task(uuid, uuid, text, boolean, jsonb, text)
  from public, authenticated, anon;
grant execute on function public.complete_local_worker_task(uuid, uuid, text, boolean, jsonb, text)
  to service_role;
