drop policy if exists project_team_member_select on public.project_teams;
create policy project_team_member_select on public.project_teams
for select using (
  exists (
    select 1
    from public.projects p
    join public.teams t on t.id = project_teams.team_id
    where p.id = project_teams.project_id
      and t.organization_id = p.organization_id
      and public.is_organization_member(p.organization_id)
  )
);

drop policy if exists project_team_admin_write on public.project_teams;
create policy project_team_admin_write on public.project_teams
for all using (
  exists (
    select 1
    from public.projects p
    join public.teams t on t.id = project_teams.team_id
    where p.id = project_teams.project_id
      and t.organization_id = p.organization_id
      and public.has_organization_role(p.organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  )
) with check (
  exists (
    select 1
    from public.projects p
    join public.teams t on t.id = project_teams.team_id
    where p.id = project_teams.project_id
      and t.organization_id = p.organization_id
      and public.has_organization_role(p.organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  )
);
