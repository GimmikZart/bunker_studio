-- Tasks persist their estimate inside definition_of_done_json. Keep the
-- preflight calculation aligned with that canonical payload.
create or replace function public.enforce_queued_budget_policies()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with exceeded as (
    select
      candidate.id,
      candidate.organization_id,
      candidate.title,
      bool_or(policy.action_on_hard = 'BLOCK') as hard_block
    from public.tasks candidate
    join public.budget_policies policy
      on policy.organization_id = candidate.organization_id
      and policy.enabled
      and policy.hard_limit > 0
      and (policy.project_id is null or policy.project_id = candidate.project_id)
      and (policy.agent_id is null or policy.agent_id = candidate.assigned_agent_id)
    where candidate.state = 'QUEUED'
      and coalesce((
        select sum(ledger.amount)
        from public.cost_ledger ledger
        where ledger.organization_id = candidate.organization_id
          and (policy.project_id is null or ledger.project_id = policy.project_id)
          and (policy.agent_id is null or ledger.agent_id = policy.agent_id)
          and policy.period_type <> 'PER_RUN'
          and (
            (policy.period_type = 'PER_TASK' and ledger.task_id = candidate.id)
            or (policy.period_type = 'DAILY' and ledger.occurred_at >= date_trunc('day', now()))
            or (policy.period_type = 'MONTHLY' and ledger.occurred_at >= date_trunc('month', now()))
          )
      ), 0) + coalesce(nullif(candidate.definition_of_done_json ->> 'estimated_cost', '')::numeric, 0)
        > policy.hard_limit
    group by candidate.id, candidate.organization_id, candidate.title
  ), changed as (
    update public.tasks candidate
    set state = case when exceeded.hard_block then 'BLOCKED' else 'WAITING_BUDGET_APPROVAL' end,
      completed_at = case when exceeded.hard_block then now() else null end
    from exceeded
    where candidate.id = exceeded.id
      and candidate.state = 'QUEUED'
    returning candidate.id, candidate.organization_id, candidate.title, exceeded.hard_block
  )
  insert into public.notifications (
    organization_id, user_id, category, severity, title, body, deep_link
  )
  select
    changed.organization_id,
    member.user_id,
    'BUDGET',
    case when changed.hard_block then 'CRITICAL' else 'HIGH' end,
    case when changed.hard_block then 'Task blocked by hard budget' else 'Budget approval required' end,
    'Task "' || changed.title || '" cannot start until the budget policy is resolved.',
    '/tasks?taskId=' || changed.id::text
  from changed
  join public.organization_members member on member.organization_id = changed.organization_id
  where member.role in ('OWNER', 'ADMIN');
end;
$$;
