-- Connecting a repository saves the row with an upsert on
-- (organization_id, project_id), but the only unique index covering those
-- columns was partial: `where project_id is not null`. PostgreSQL will not use a
-- partial index for ON CONFLICT unless the statement repeats the same
-- predicate, which PostgREST does not emit, so every attempt failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification". Connecting a repository could never succeed.
--
-- A plain unique index behaves the same for the rows that matter: project_id is
-- nullable and NULLs compare as distinct, so rows without a project stay
-- unconstrained exactly as before. The difference is that ON CONFLICT can use
-- this one.
drop index if exists public.repo_connections_organization_project_idx;
create unique index if not exists repo_connections_organization_project_idx
  on public.repo_connections(organization_id, project_id);
