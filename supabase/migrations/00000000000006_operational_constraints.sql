alter table public.repo_connections add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.meetings add column if not exists cost numeric not null default 0;
alter table public.worker_nodes add column if not exists max_concurrent int not null default 1;
alter table public.worker_nodes add column if not exists active_jobs int not null default 0;
alter table public.design_versions add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.design_versions alter column design_request_id drop not null;
alter table public.design_versions enable row level security;
create policy design_version_tenant_isolation on public.design_versions
  for all using (public.is_organization_member(organization_id))
  with check (organization_id is not null and public.is_organization_member(organization_id));
create unique index if not exists one_current_design_organization
  on public.design_versions(organization_id) where status = 'APPROVED';
alter table public.conversations add column if not exists external_session_id text;
create unique index if not exists conversations_external_session_idx
  on public.conversations(organization_id, primary_agent_id, external_session_id)
  where external_session_id is not null;
alter table public.task_dependencies enable row level security;
create policy task_dependency_tenant_isolation on public.task_dependencies
  for all using (exists (select 1 from public.tasks t where t.id = task_id and public.is_organization_member(t.organization_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.is_organization_member(t.organization_id)));
create unique index if not exists repo_connections_organization_project_idx
  on public.repo_connections(organization_id, project_id)
  where project_id is not null;
create unique index if not exists push_subscriptions_user_endpoint_idx
  on public.push_subscriptions(user_id, endpoint);
