-- The owner-preservation trigger rejected every DELETE of an OWNER membership,
-- including the cascade that runs when the organization itself is deleted. No
-- organization could be removed, by anyone, through any path.
--
-- Removing the owner from a live organization is still refused. When the parent
-- organization is being deleted, its row is already gone inside the same
-- transaction by the time the cascade reaches this table, so the membership may
-- follow it.
create or replace function public.prevent_owner_membership_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.role = 'OWNER' then
    if exists (select 1 from public.organizations where id = old.organization_id) then
      raise exception 'An organization owner cannot be removed.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.role = 'OWNER' and new.role <> 'OWNER' then
    raise exception 'An organization owner role cannot be changed.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
