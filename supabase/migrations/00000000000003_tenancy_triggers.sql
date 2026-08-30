-- Keep the first authenticated session usable immediately after signup.
-- Both triggers are SECURITY DEFINER and have a fixed search_path so their
-- behavior does not depend on the caller's role or session settings.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

create or replace function public.add_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_user_id, 'OWNER')
  on conflict (organization_id, user_id) do update set role = 'OWNER';
  return new;
end;
$$;

drop trigger if exists organization_owner_membership on public.organizations;
create trigger organization_owner_membership
  after insert on public.organizations
  for each row execute function public.add_organization_owner();
