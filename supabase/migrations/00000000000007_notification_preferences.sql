create table public.notification_preferences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, category)
);

alter table public.notification_preferences enable row level security;
create policy notification_preferences_self_access on public.notification_preferences
  for all using (user_id = auth.uid() and public.is_organization_member(organization_id))
  with check (user_id = auth.uid() and public.is_organization_member(organization_id));
