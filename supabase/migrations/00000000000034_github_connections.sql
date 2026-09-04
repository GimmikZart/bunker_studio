-- A GitHub account belongs to the organization, not to a project. Connecting it
-- once in Settings is what lets project creation offer the repositories the
-- token can already see instead of asking for owner, name and branch by hand.
-- An organization may hold several accounts, so a studio can reach repositories
-- owned by different GitHub users or organizations.
create table if not exists public.github_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_login text not null,
  account_type text not null default 'USER',
  encrypted_auth_blob jsonb not null,
  status text not null default 'CONNECTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The same account connects once per organization: reconnecting replaces the
-- stored token rather than accumulating duplicates to choose between.
create unique index if not exists github_connections_organization_account_idx
  on public.github_connections(organization_id, lower(account_login));

alter table public.github_connections enable row level security;
drop policy if exists github_connections_tenant_isolation on public.github_connections;
create policy github_connections_tenant_isolation on public.github_connections
  for all using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

-- Which account a repository was chosen from. The per-project credential copy
-- stays in place so worker, review and CI paths keep reading one row.
alter table public.repo_connections
  add column if not exists github_connection_id uuid
  references public.github_connections(id) on delete set null;
