create type public.organization_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
create type public.autonomy_mode as enum ('MANUAL', 'SUPERVISED', 'AUTONOMOUS', 'LAB');
create type public.project_status as enum ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  owner_user_id uuid not null references auth.users(id),
  default_autonomy_mode public.autonomy_mode not null default 'AUTONOMOUS',
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '',
  archived_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null,
  description text not null default '',
  autonomy_mode public.autonomy_mode not null default 'AUTONOMOUS',
  status public.project_status not null default 'ACTIVE',
  is_studio_core boolean not null default false,
  default_team_id uuid references public.teams(id),
  default_branch text not null default 'main',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, slug)
);

create table public.project_teams (
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (project_id, team_id)
);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid() and role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.teams enable row level security;
alter table public.projects enable row level security;
alter table public.project_teams enable row level security;

create policy profiles_self_select on public.profiles for select using (user_id = auth.uid());
create policy profiles_self_update on public.profiles for update using (user_id = auth.uid());
create policy organization_member_select on public.organizations for select using (public.is_organization_member(id));
create policy organization_owner_insert on public.organizations for insert with check (owner_user_id = auth.uid());
create policy organization_admin_update on public.organizations for update using (public.has_organization_role(id, array['OWNER', 'ADMIN']::public.organization_role[]));
create policy organization_member_select on public.organization_members for select using (public.is_organization_member(organization_id));
create policy organization_owner_manage on public.organization_members for all using (public.has_organization_role(organization_id, array['OWNER']::public.organization_role[]));
create policy team_member_select on public.teams for select using (public.is_organization_member(organization_id));
create policy team_admin_write on public.teams for all using (public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[]));
create policy project_member_select on public.projects for select using (public.is_organization_member(organization_id));
create policy project_admin_write on public.projects for all using (public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[]));
create policy project_team_member_select on public.project_teams for select using (
  exists (select 1 from public.projects p where p.id = project_id and public.is_organization_member(p.organization_id))
);
create policy project_team_admin_write on public.project_teams for all using (
  exists (select 1 from public.projects p where p.id = project_id and public.has_organization_role(p.organization_id, array['OWNER', 'ADMIN']::public.organization_role[]))
);

create index organizations_owner_idx on public.organizations(owner_user_id) where archived_at is null;
create index teams_organization_idx on public.teams(organization_id) where archived_at is null;
create index projects_organization_idx on public.projects(organization_id) where archived_at is null;
