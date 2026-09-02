-- Membership management is Owner-only. Preserve a durable Owner row even if a
-- client reaches the table directly under the RLS owner-management policy.
create or replace function public.prevent_owner_membership_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.role = 'OWNER' then
    raise exception 'An organization owner cannot be removed.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.role = 'OWNER' and new.role <> 'OWNER' then
    raise exception 'An organization owner role cannot be changed.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists preserve_organization_owner_membership on public.organization_members;
create trigger preserve_organization_owner_membership
  before update or delete on public.organization_members
  for each row execute function public.prevent_owner_membership_change();
