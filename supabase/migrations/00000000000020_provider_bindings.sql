alter table public.provider_connections
  add column if not exists api_base_url text,
  add column if not exists catalog_source text not null default 'MANUAL';

create unique index if not exists model_catalog_connection_model_unique
  on public.model_catalog(provider_connection_id, provider_model_id)
  where provider_connection_id is not null;

create or replace function public.create_provider_connection_with_catalog(
  target_organization_id uuid,
  input_provider_type text,
  input_display_name text,
  input_encrypted_secret jsonb,
  input_api_base_url text,
  input_catalog_source text,
  input_models jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  connection_id uuid;
  model jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = target_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND' using errcode = '23503';
  end if;
  if jsonb_typeof(input_models) <> 'array' or jsonb_array_length(input_models) = 0 then
    raise exception 'MODEL_CATALOG_REQUIRED' using errcode = '23514';
  end if;

  insert into public.provider_connections (
    organization_id, provider_type, display_name, encrypted_secret_blob, auth_mode,
    status, capabilities_json, last_verified_at, api_base_url, catalog_source
  ) values (
    target_organization_id, input_provider_type, trim(input_display_name),
    input_encrypted_secret, 'API_KEY', 'READY',
    jsonb_build_object('items', jsonb_build_array('text', 'streaming', 'tool-calling')),
    now(), input_api_base_url, input_catalog_source
  ) returning id into connection_id;

  for model in select * from jsonb_array_elements(input_models)
  loop
    insert into public.model_catalog (
      provider_connection_id, provider_type, provider_model_id, display_name,
      capabilities_json, status
    ) values (
      connection_id, input_provider_type, model ->> 'id',
      coalesce(model ->> 'displayName', model ->> 'id'),
      coalesce(model -> 'capabilities', '[]'::jsonb), 'ACTIVE'
    );
  end loop;

  return connection_id;
end;
$$;

revoke all on function public.create_provider_connection_with_catalog(
  uuid, text, text, jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_provider_connection_with_catalog(
  uuid, text, text, jsonb, text, text, jsonb
) to service_role;

create or replace function public.create_agent_with_binding(
  target_organization_id uuid,
  input_name text,
  input_role_key text,
  input_title text,
  input_personality_json jsonb,
  target_provider_connection_id uuid,
  target_provider_model_id text,
  target_runtime_type text,
  target_reasoning_effort text
)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  role_key text,
  title text,
  personality_json jsonb,
  archived_at timestamptz,
  provider_binding_id uuid,
  provider_type text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  agent_id uuid;
  binding_id uuid;
  selected_provider_type text;
begin
  if not public.has_organization_role(
    target_organization_id,
    array['OWNER', 'ADMIN']::public.organization_role[]
  ) then
    raise exception 'Owner or admin access is required.' using errcode = '42501';
  end if;

  select connection.provider_type into selected_provider_type
  from public.provider_connections connection
  where connection.id = target_provider_connection_id
    and connection.organization_id = target_organization_id
    and connection.status = 'READY';
  if selected_provider_type is null then
    raise exception 'PROVIDER_CONNECTION_NOT_READY' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.model_catalog model
    where model.provider_connection_id = target_provider_connection_id
      and model.provider_model_id = target_provider_model_id
      and model.status = 'ACTIVE'
  ) then
    raise exception 'PROVIDER_MODEL_NOT_AVAILABLE' using errcode = '23514';
  end if;

  if target_reasoning_effort not in ('none', 'low', 'medium', 'high', 'xhigh', 'max') then
    raise exception 'INVALID_REASONING_EFFORT' using errcode = '23514';
  end if;
  if target_runtime_type not in ('OPENAI', 'ANTHROPIC', 'OPENAI_COMPATIBLE', 'CODEX_SDK') then
    raise exception 'INVALID_RUNTIME_TYPE' using errcode = '23514';
  end if;
  if not (
    (selected_provider_type = 'OPENAI' and target_runtime_type in ('OPENAI', 'CODEX_SDK'))
    or (selected_provider_type = 'ANTHROPIC' and target_runtime_type = 'ANTHROPIC')
    or (selected_provider_type = 'OPENAI_COMPATIBLE' and target_runtime_type = 'OPENAI_COMPATIBLE')
  ) then
    raise exception 'RUNTIME_PROVIDER_MISMATCH' using errcode = '23514';
  end if;

  agent_id := gen_random_uuid();
  insert into public.agents (
    id, organization_id, name, role_key, title, personality_json, memory_namespace
  ) values (
    agent_id,
    target_organization_id,
    trim(input_name),
    input_role_key,
    coalesce(input_title, ''),
    coalesce(input_personality_json, '{}'),
    'org/' || target_organization_id::text || '/agent/' || agent_id::text
  );

  insert into public.agent_bindings (
    agent_id, provider_connection_id, provider_model_id, runtime_type, reasoning_effort
  ) values (
    agent_id,
    target_provider_connection_id,
    target_provider_model_id,
    target_runtime_type,
    target_reasoning_effort
  ) returning public.agent_bindings.id into binding_id;

  return query
    select agent.id, agent.organization_id, agent.name, agent.role_key, agent.title,
      agent.personality_json, agent.archived_at, binding_id, selected_provider_type
    from public.agents agent
    where agent.id = agent_id;
end;
$$;

revoke all on function public.create_agent_with_binding(
  uuid, text, text, text, jsonb, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_agent_with_binding(
  uuid, text, text, text, jsonb, uuid, text, text, text
) to authenticated, service_role;

create or replace function public.switch_agent_binding_v2(
  target_agent_id uuid,
  target_provider_connection_id uuid,
  target_provider_model_id text,
  target_runtime_type text,
  target_reasoning_effort text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_organization_id uuid;
  binding_id uuid;
  selected_provider_type text;
begin
  select agent.organization_id into target_organization_id
  from public.agents agent
  where agent.id = target_agent_id and agent.archived_at is null;

  if target_organization_id is null or not public.has_organization_role(
    target_organization_id,
    array['OWNER', 'ADMIN']::public.organization_role[]
  ) then
    raise exception 'Owner or admin access is required.' using errcode = '42501';
  end if;

  select connection.provider_type into selected_provider_type
    from public.provider_connections connection
    join public.model_catalog model on model.provider_connection_id = connection.id
    where connection.id = target_provider_connection_id
      and connection.organization_id = target_organization_id
      and connection.status = 'READY'
      and model.provider_model_id = target_provider_model_id
      and model.status = 'ACTIVE';
  if selected_provider_type is null then
    raise exception 'PROVIDER_MODEL_NOT_AVAILABLE' using errcode = '23514';
  end if;

  if target_reasoning_effort not in ('none', 'low', 'medium', 'high', 'xhigh', 'max') then
    raise exception 'INVALID_REASONING_EFFORT' using errcode = '23514';
  end if;
  if target_runtime_type not in ('OPENAI', 'ANTHROPIC', 'OPENAI_COMPATIBLE', 'CODEX_SDK') then
    raise exception 'INVALID_RUNTIME_TYPE' using errcode = '23514';
  end if;
  if not (
    (selected_provider_type = 'OPENAI' and target_runtime_type in ('OPENAI', 'CODEX_SDK'))
    or (selected_provider_type = 'ANTHROPIC' and target_runtime_type = 'ANTHROPIC')
    or (selected_provider_type = 'OPENAI_COMPATIBLE' and target_runtime_type = 'OPENAI_COMPATIBLE')
  ) then
    raise exception 'RUNTIME_PROVIDER_MISMATCH' using errcode = '23514';
  end if;

  update public.agent_bindings
  set active_to = now()
  where agent_id = target_agent_id and active_to is null;

  insert into public.agent_bindings (
    agent_id, provider_connection_id, provider_model_id, runtime_type, reasoning_effort
  ) values (
    target_agent_id,
    target_provider_connection_id,
    target_provider_model_id,
    target_runtime_type,
    target_reasoning_effort
  ) returning public.agent_bindings.id into binding_id;

  return binding_id;
end;
$$;

revoke all on function public.switch_agent_binding_v2(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.switch_agent_binding_v2(uuid, uuid, text, text, text)
  to authenticated, service_role;
