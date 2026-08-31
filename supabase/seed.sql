-- Deterministic local demo dataset. This file is used by `supabase db reset`
-- and must never be copied to a production project.
--
-- The demo user intentionally has no password. Local development can use the
-- non-production fixture header (`x-bunker-user-id`) or create a normal user
-- through the signup flow. No credential or provider secret is seeded here.
do $$
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values (
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'demo@bunker.local',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Bunker Demo Owner"}'::jsonb,
    now(),
    now(),
    false,
    false
  )
  on conflict (id) do nothing;
end $$;

insert into public.organizations (id, name, slug, owner_user_id, default_autonomy_mode)
values (
  '00000000-0000-0000-0000-000000000010',
  'Bunker Demo Studio',
  'bunker-demo',
  '00000000-0000-0000-0000-000000000001',
  'SUPERVISED'
)
on conflict (id) do nothing;

insert into public.teams (id, organization_id, name, description)
values
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000010',
    'Core Product',
    'Demo team for the product workflow.'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000010',
    'Quality & Security',
    'Demo team for review and verification.'
  )
on conflict (id) do nothing;

insert into public.projects (
  id,
  organization_id,
  name,
  slug,
  description,
  autonomy_mode,
  is_studio_core,
  default_team_id,
  default_branch
)
values (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000010',
  'Bunker Demo App',
  'bunker-demo-app',
  'A seeded project for exploring the Bunker Studio workflow.',
  'SUPERVISED',
  false,
  '00000000-0000-0000-0000-000000000011',
  'main'
)
on conflict (id) do nothing;

insert into public.project_teams (project_id, team_id)
values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000012')
on conflict do nothing;

insert into public.provider_connections (
  id,
  organization_id,
  provider_type,
  display_name,
  auth_mode,
  status,
  capabilities_json
)
values (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000010',
  'fake',
  'Local demo runtime',
  'NONE',
  'READY',
  '{"streaming":true,"resumable":true}'::jsonb
)
on conflict (id) do nothing;

insert into public.model_catalog (
  id,
  provider_connection_id,
  provider_type,
  provider_model_id,
  display_name,
  capabilities_json,
  status
)
values (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000030',
  'fake',
  'fake-default',
  'Deterministic demo model',
  '{"streaming":true,"resumable":true}'::jsonb,
  'ACTIVE'
)
on conflict (id) do nothing;

insert into public.agents (
  id,
  organization_id,
  name,
  role_key,
  title,
  personality_json,
  memory_namespace,
  status
)
values
  (
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000010',
    'Atlas',
    'lead',
    'Lead Architect',
    '{"style":"structured","tone":"calm"}'::jsonb,
    'demo-atlas',
    'ACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000010',
    'Nova',
    'frontend',
    'Frontend Engineer',
    '{"style":"iterative","tone":"curious"}'::jsonb,
    'demo-nova',
    'ACTIVE'
  ),
  (
    '00000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000010',
    'Sentinel',
    'reviewer',
    'Reviewer / QA',
    '{"style":"evidence-first","tone":"precise"}'::jsonb,
    'demo-sentinel',
    'ACTIVE'
  )
on conflict (id) do nothing;

insert into public.agent_bindings (
  id,
  agent_id,
  provider_connection_id,
  provider_model_id,
  runtime_type,
  reasoning_effort
)
values
  (
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000030',
    'fake-default',
    'fake',
    'standard'
  ),
  (
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000030',
    'fake-default',
    'fake',
    'standard'
  ),
  (
    '00000000-0000-0000-0000-000000000052',
    '00000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000030',
    'fake-default',
    'fake',
    'standard'
  )
on conflict (id) do nothing;

insert into public.agent_assignments (id, organization_id, agent_id, team_id, project_id, active)
values
  (
    '00000000-0000-0000-0000-000000000060',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000020',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000061',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000020',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000062',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000020',
    true
  )
on conflict (id) do nothing;

insert into public.workflows (
  id,
  organization_id,
  project_id,
  goal,
  status,
  created_by_user_id
)
values (
  '00000000-0000-0000-0000-000000000070',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020',
  'Ship the seeded demo app',
  'IDLE',
  '00000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into public.tasks (
  id,
  organization_id,
  project_id,
  workflow_id,
  title,
  description,
  task_type,
  state,
  assigned_agent_id,
  read_scope_json,
  write_scope_json,
  definition_of_done_json,
  parallel_group_id
)
values
  (
    '00000000-0000-0000-0000-000000000080',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000070',
    'Create the demo shell',
    'Build the initial responsive shell and navigation.',
    'CODE',
    'DRAFT',
    '00000000-0000-0000-0000-000000000041',
    '["src/app"]'::jsonb,
    '["src/app/layout.tsx"]'::jsonb,
    '{"checks":["pnpm test:e2e"]}'::jsonb,
    'demo-ui'
  ),
  (
    '00000000-0000-0000-0000-000000000081',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000070',
    'Verify the demo shell',
    'Review the shell for correctness and accessibility.',
    'REVIEW',
    'READY',
    '00000000-0000-0000-0000-000000000042',
    '["src/app"]'::jsonb,
    '[]'::jsonb,
    '{"checks":["pnpm lint","pnpm typecheck"]}'::jsonb,
    'demo-review'
  )
on conflict (id) do nothing;

insert into public.task_dependencies (task_id, depends_on_task_id)
values (
  '00000000-0000-0000-0000-000000000081',
  '00000000-0000-0000-0000-000000000080'
)
on conflict do nothing;

update public.workflows
set root_task_id = '00000000-0000-0000-0000-000000000080'
where id = '00000000-0000-0000-0000-000000000070';

insert into public.memories (
  id,
  organization_id,
  project_id,
  agent_id,
  memory_type,
  title,
  content,
  importance,
  pinned,
  source_type
)
values (
  '00000000-0000-0000-0000-000000000090',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000040',
  'DECISION',
  'Demo architecture boundary',
  'Keep orchestration state in Supabase and provider execution behind runtime adapters.',
  90,
  true,
  'SEED'
)
on conflict (id) do nothing;

insert into public.decisions (
  id,
  organization_id,
  project_id,
  title,
  decision,
  rationale,
  consequences
)
values (
  '00000000-0000-0000-0000-000000000091',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020',
  'Use adapter-bound runtimes',
  'Provider-specific protocol details stay outside core orchestration.',
  'This preserves provider independence and makes local testing deterministic.',
  'New providers must implement the normalized runtime contract.'
)
on conflict (id) do nothing;
