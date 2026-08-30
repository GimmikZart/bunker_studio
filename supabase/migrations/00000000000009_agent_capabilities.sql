alter table public.agents
  add column if not exists skills_json jsonb not null default '[]'::jsonb,
  add column if not exists tools_json jsonb not null default '[]'::jsonb,
  add column if not exists permissions_json jsonb not null default '[]'::jsonb;

alter table public.agents
  drop constraint if exists agents_skills_json_array,
  drop constraint if exists agents_tools_json_array,
  drop constraint if exists agents_permissions_json_array;

alter table public.agents
  add constraint agents_skills_json_array check (jsonb_typeof(skills_json) = 'array'),
  add constraint agents_tools_json_array check (jsonb_typeof(tools_json) = 'array'),
  add constraint agents_permissions_json_array check (jsonb_typeof(permissions_json) = 'array');
