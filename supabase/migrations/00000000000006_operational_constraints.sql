alter table public.repo_connections add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.meetings add column if not exists cost numeric not null default 0;
create unique index if not exists repo_connections_organization_project_idx
  on public.repo_connections(organization_id, project_id)
  where project_id is not null;
create unique index if not exists push_subscriptions_user_endpoint_idx
  on public.push_subscriptions(user_id, endpoint);
