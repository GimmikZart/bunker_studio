create or replace function public.switch_agent_binding(
  target_agent_id uuid,
  binding_label text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_organization_id uuid;
  connection_id uuid;
  binding_id uuid;
begin
  select a.organization_id into target_organization_id
  from public.agents a
  where a.id = target_agent_id and a.archived_at is null;

  if target_organization_id is null or not public.has_organization_role(
    target_organization_id,
    array['OWNER', 'ADMIN']::public.organization_role[]
  ) then
    raise exception 'Owner or admin access is required.' using errcode = '42501';
  end if;

  insert into public.provider_connections (
    organization_id, provider_type, display_name, auth_mode, status, capabilities_json
  ) values (
    target_organization_id, 'OPENAI_COMPATIBLE',
    coalesce(nullif(trim(binding_label), ''), 'Unconfigured provider'),
    'NONE', 'UNVERIFIED', '{}'
  ) returning public.provider_connections.id into connection_id;

  update public.agent_bindings
  set active_to = now()
  where agent_id = target_agent_id and active_to is null;

  insert into public.agent_bindings (
    agent_id, provider_connection_id, provider_model_id, runtime_type
  ) values (
    target_agent_id, connection_id,
    coalesce(nullif(trim(binding_label), ''), 'default'), 'OPENAI_COMPATIBLE'
  ) returning public.agent_bindings.id into binding_id;

  return binding_id;
end;
$$;

revoke all on function public.switch_agent_binding(uuid, text) from public, anon, authenticated;
grant execute on function public.switch_agent_binding(uuid, text) to authenticated, service_role;
