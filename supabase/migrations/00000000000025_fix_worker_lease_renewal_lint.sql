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

  update public.local_worker_leases as lease
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where lease.id = p_lease_id
    and lease.worker_node_id = p_node_id
    and lease.status = 'ACTIVE'
    and lease.lease_expires_at > now()
  returning lease.lease_expires_at into renewed_until;

  return query select true, renewed_until is not null, renewed_until;
end;
$$;

revoke execute on function public.renew_local_worker_lease(uuid, uuid, text, int)
  from public, authenticated, anon;
grant execute on function public.renew_local_worker_lease(uuid, uuid, text, int)
  to service_role;
