alter table public.agent_assignments
  add column if not exists organization_id uuid;

update public.agent_assignments aa
set organization_id = a.organization_id
from public.agents a
where a.id = aa.agent_id and aa.organization_id is null;

alter table public.agent_assignments
  drop constraint if exists agent_assignments_organization_fk;

alter table public.agent_assignments
  add constraint agent_assignments_organization_fk
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.agent_assignments
  alter column organization_id set not null;

drop policy if exists agent_assignment_tenant_isolation on public.agent_assignments;
create policy agent_assignment_tenant_isolation on public.agent_assignments
for all using (
  exists (
    select 1 from public.agents a
    where a.id = agent_assignments.agent_id
      and a.organization_id = agent_assignments.organization_id
      and public.is_organization_member(agent_assignments.organization_id)
  )
) with check (
  exists (
    select 1 from public.agents a
    where a.id = agent_assignments.agent_id
      and a.organization_id = agent_assignments.organization_id
      and public.is_organization_member(agent_assignments.organization_id)
  )
  and (team_id is null or exists (
    select 1 from public.teams t
    where t.id = agent_assignments.team_id and t.organization_id = agent_assignments.organization_id
  ))
  and (project_id is null or exists (
    select 1 from public.projects p
    where p.id = agent_assignments.project_id and p.organization_id = agent_assignments.organization_id
  ))
  and (reports_to_agent_id is null or exists (
    select 1 from public.agents reporting_agent
    where reporting_agent.id = agent_assignments.reports_to_agent_id
      and reporting_agent.organization_id = agent_assignments.organization_id
  ))
);
