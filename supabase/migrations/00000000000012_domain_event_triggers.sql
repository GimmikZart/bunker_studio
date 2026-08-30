create or replace function public.append_domain_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row jsonb;
  organization uuid;
  aggregate uuid;
begin
  current_row := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  organization := (current_row ->> 'organization_id')::uuid;
  aggregate := (current_row ->> 'id')::uuid;
  if organization is null or aggregate is null then
    return coalesce(NEW, OLD);
  end if;
  insert into public.domain_events (
    organization_id,
    aggregate_type,
    aggregate_id,
    event_type,
    payload_json,
    correlation_id
  ) values (
    organization,
    TG_TABLE_NAME,
    aggregate,
    upper(TG_OP) || '_' || upper(TG_TABLE_NAME),
    jsonb_build_object('operation', TG_OP),
    gen_random_uuid()
  );
  return coalesce(NEW, OLD);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'teams', 'projects', 'agents', 'agent_assignments', 'provider_connections',
    'provider_sessions', 'workflows', 'tasks', 'task_attempts', 'agent_runs',
    'reviews', 'verification_runs', 'design_requests', 'design_versions',
    'conversations', 'messages', 'memories', 'decisions', 'meetings',
    'meeting_contributions', 'approvals', 'cost_ledger', 'budget_policies',
    'notifications', 'worker_nodes', 'repo_connections', 'artifacts'
  ] loop
    execute format('drop trigger if exists append_domain_event on public.%I', table_name);
    execute format(
      'create trigger append_domain_event after insert or update or delete on public.%I for each row execute function public.append_domain_event()',
      table_name
    );
  end loop;
end;
$$;
