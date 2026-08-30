create or replace function public.create_agent_with_default_binding(
  target_organization_id uuid,
  input_name text,
  input_role_key text,
  input_title text,
  input_personality_json jsonb,
  binding_label text
)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  role_key text,
  title text,
  personality_json jsonb,
  archived_at timestamptz,
  provider_binding_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  connection_id uuid;
  agent_id uuid;
  binding_id uuid;
begin
  if not public.has_organization_role(
    target_organization_id,
    array['OWNER', 'ADMIN']::public.organization_role[]
  ) then
    raise exception 'Owner or admin access is required.' using errcode = '42501';
  end if;

  insert into public.provider_connections (
    organization_id, provider_type, display_name, auth_mode, status, capabilities_json
  ) values (
    target_organization_id,
    'OPENAI_COMPATIBLE',
    coalesce(nullif(trim(binding_label), ''), 'Unconfigured provider'),
    'NONE',
    'UNVERIFIED',
    '{}'
  ) returning public.provider_connections.id into connection_id;

  insert into public.agents (
    organization_id, name, role_key, title, personality_json, memory_namespace
  ) values (
    target_organization_id,
    trim(input_name),
    input_role_key,
    coalesce(input_title, ''),
    coalesce(input_personality_json, '{}'),
    'org/' || target_organization_id::text || '/agent/' || gen_random_uuid()::text
  ) returning public.agents.id into agent_id;

  insert into public.agent_bindings (
    agent_id, provider_connection_id, provider_model_id, runtime_type
  ) values (
    agent_id, connection_id, coalesce(nullif(trim(binding_label), ''), 'default'), 'OPENAI_COMPATIBLE'
  ) returning public.agent_bindings.id into binding_id;

  return query
    select a.id, a.organization_id, a.name, a.role_key, a.title,
      a.personality_json, a.archived_at, binding_id
    from public.agents a
    where a.id = agent_id;
end;
$$;

revoke all on function public.create_agent_with_default_binding(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_agent_with_default_binding(uuid, text, text, text, jsonb, text) to authenticated, service_role;
