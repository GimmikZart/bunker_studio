-- Creating an organization returned the new row, and the returned row was
-- checked against the SELECT policy `is_organization_member(id)`. The trigger
-- that records the owner as a member runs after the insert completes, so at
-- that moment the creator was not yet a member and the whole statement failed
-- with "new row violates row-level security policy". Organization creation
-- could therefore never succeed through the normal client path.
--
-- An owner can always read their own organization, independently of the
-- membership row. Policies are permissive and combined with OR, so this only
-- widens SELECT for the owner and changes nothing else.
--
-- Dropped first so the file can be re-applied: a database where this policy was
-- created by hand, or by a push whose ledger entry was lost, would otherwise
-- fail with "policy already exists" and block every later migration behind it.
drop policy if exists organization_owner_select on public.organizations;
create policy organization_owner_select on public.organizations
  for select using (owner_user_id = auth.uid());
