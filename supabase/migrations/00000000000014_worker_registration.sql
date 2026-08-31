create table public.worker_registration_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  allowed_scopes_json jsonb not null default '{"items":[]}'::jsonb,
  max_concurrent int not null default 1 check (max_concurrent > 0 and max_concurrent <= 32),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.worker_registration_tokens enable row level security;
create policy worker_registration_token_admin_access on public.worker_registration_tokens
  for all using (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = worker_registration_tokens.organization_id
        and member.user_id = auth.uid()
        and member.role in ('OWNER', 'ADMIN')
    )
  ) with check (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = worker_registration_tokens.organization_id
        and member.user_id = auth.uid()
        and member.role in ('OWNER', 'ADMIN')
    )
  );

create or replace function public.exchange_worker_registration_token(
  p_token_hash text,
  p_name text,
  p_capabilities jsonb
)
returns table (
  node_id uuid,
  organization_id uuid,
  name text,
  capabilities_json jsonb,
  allowed_scopes_json jsonb,
  max_concurrent int,
  credential text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record public.worker_registration_tokens%rowtype;
  generated_credential text;
  generated_node_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'INVALID_WORKER_NAME';
  end if;
  select * into token_record
  from public.worker_registration_tokens
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  for update;
  if not found then raise exception 'INVALID_WORKER_REGISTRATION_TOKEN'; end if;

  generated_credential := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.worker_nodes (
    organization_id, node_type, name, status, credential_hash,
    capabilities_json, allowed_scopes_json, max_concurrent, active_jobs,
    last_heartbeat_at
  ) values (
    token_record.organization_id, 'LOCAL', trim(p_name), 'ONLINE',
    encode(extensions.digest(generated_credential, 'sha256'), 'hex'),
    jsonb_build_object('items', coalesce(p_capabilities, '[]'::jsonb)),
    token_record.allowed_scopes_json, token_record.max_concurrent, 0, now()
  ) returning id into generated_node_id;

  update public.worker_registration_tokens
  set used_at = now()
  where id = token_record.id;

  return query
    select generated_node_id, token_record.organization_id, node.name,
      node.capabilities_json, node.allowed_scopes_json, node.max_concurrent,
      generated_credential
    from public.worker_nodes node
    where node.id = generated_node_id;
end;
$$;

revoke execute on function public.exchange_worker_registration_token(text, text, jsonb)
  from public, authenticated, anon;
grant execute on function public.exchange_worker_registration_token(text, text, jsonb)
  to service_role;

create or replace function public.heartbeat_local_worker(
  p_node_id uuid,
  p_credential_hash text
)
returns setof public.worker_nodes
language sql
security definer
set search_path = public
as $$
  update public.worker_nodes
  set status = 'ONLINE', last_heartbeat_at = now()
  where id = p_node_id
    and credential_hash = p_credential_hash
    and revoked_at is null
  returning *;
$$;

revoke execute on function public.heartbeat_local_worker(uuid, text)
  from public, authenticated, anon;
grant execute on function public.heartbeat_local_worker(uuid, text)
  to service_role;
