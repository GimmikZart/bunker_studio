# Bunker Studio — Data Model

PostgreSQL is authoritative.

All tenant-owned tables include `organization_id` unless ownership is indirectly and unambiguously enforceable. Prefer explicit tenant column for RLS simplicity.

IDs: UUID v7 when library/runtime support is stable; otherwise UUID v4. Do not use sequential public IDs.

Timestamps: `timestamptz` UTC.

## 1. Identity / tenancy

### `profiles`
- `user_id` PK/FK auth.users
- display_name
- avatar_url
- created_at
- updated_at

### `organizations`
- id
- name
- slug
- owner_user_id
- default_autonomy_mode
- created_at
- archived_at

### `organization_members`
- organization_id
- user_id
- role `OWNER|ADMIN|MEMBER|VIEWER`
- created_at

Unique organization/user.

## 2. Teams/projects

### `teams`
- id
- organization_id
- name
- description
- archived_at

### `projects`
- id
- organization_id
- name
- slug
- description
- autonomy_mode
- status
- is_studio_core boolean
- default_team_id nullable
- repo_connection_id nullable
- default_branch
- created_at
- archived_at

### `project_teams`
- project_id
- team_id

## 3. Agents

### `agents`
- id
- organization_id
- name
- avatar_asset_id nullable
- role_key
- title
- personality_json
- base_instructions
- memory_namespace
- autonomy_mode nullable
- status
- created_at
- archived_at

### `agent_assignments`
- organization_id
- agent_id
- team_id nullable
- project_id nullable
- reports_to_agent_id nullable
- active

### `agent_bindings`
Versioned binding.
- id
- agent_id
- provider_connection_id
- provider_model_id
- runtime_type
- reasoning_effort
- config_json
- active_from
- active_to

Exactly one active binding per agent.

### `agent_skills`
- agent_id
- skill_version_id
- enabled
- config_json

### `agent_tools`
- agent_id
- tool_connection_id
- permissions_json

## 4. Provider/runtime

### `provider_connections`
- id
- organization_id
- provider_type
- display_name
- encrypted_secret_blob nullable
- auth_mode
- status
- capabilities_json
- last_verified_at
- created_at

### `model_catalog`
- id
- provider_connection_id nullable
- provider_type
- provider_model_id
- display_name
- capabilities_json
- pricing_json nullable
- status
- discovered_at

### `provider_sessions`
- id
- organization_id
- agent_id
- task_id nullable
- binding_id
- external_session_id
- provider_metadata
- started_at
- ended_at

## 5. Tasks/workflows

### `workflows`
- id
- organization_id
- project_id
- goal
- status
- created_by_user_id nullable
- created_by_agent_id nullable
- root_task_id nullable
- created_at
- completed_at

### `tasks`
- id
- organization_id
- project_id
- workflow_id
- parent_task_id nullable
- title
- description
- task_type
- state
- priority
- assigned_agent_id nullable
- read_scope_json
- write_scope_json
- definition_of_done_json
- verification_json
- parallel_group_id nullable
- base_commit_sha nullable
- candidate_commit_sha nullable
- approved_design_version_id nullable
- retry_count
- max_retries
- created_at
- started_at
- completed_at

### `task_dependencies`
- task_id
- depends_on_task_id
- dependency_type

DAG constraint validated in application; prevent self edge.

### `task_attempts`
- id
- task_id
- agent_id
- provider_session_id nullable
- attempt_number
- state
- started_at
- ended_at
- handoff_json
- failure_class nullable
- failure_detail nullable

## 6. Runs/events

### `agent_runs`
- id
- organization_id
- task_attempt_id nullable
- meeting_id nullable
- agent_id
- provider_session_id nullable
- state
- correlation_id
- external_run_id nullable
- resume_token_metadata jsonb
- last_event_at
- next_retry_at nullable
- retry_reason nullable
- started_at
- ended_at

### `run_events`
Normalized stream event archive.
- id bigserial/identity
- organization_id
- run_id
- seq
- event_type
- payload_json
- created_at

Unique run/seq.

### `domain_events`
- id
- organization_id
- aggregate_type
- aggregate_id
- event_type
- payload_json
- correlation_id
- created_at

Append-only at application level.

### `outbox_events`
- id
- event_type
- payload_json
- available_at
- processed_at
- attempts

## 7. Review/CI

### `reviews`
- id
- organization_id
- project_id
- task_id nullable
- reviewer_agent_id
- candidate_sha
- status
- summary
- created_at
- completed_at

### `review_findings`
- id
- review_id
- severity
- category
- title
- description
- evidence
- file_path nullable
- symbol nullable
- recommendation
- blocking
- confidence

### `verification_runs`
- id
- task_id
- kind
- command_or_check
- status
- artifact_id nullable
- duration_ms
- executed_at

## 8. Design

### `design_requests`
- id
- organization_id
- project_id
- task_id nullable
- designer_agent_id
- brief
- status
- created_at

### `design_versions`
- id
- design_request_id
- version_number
- status `DRAFT|SUBMITTED|APPROVED|REJECTED|SUPERSEDED`
- spec_json
- rationale
- preview_artifact_ids
- created_at
- approved_by nullable
- approved_at nullable

At most one approved current version per request.

## 9. Conversations/memory

### `conversations`
- id
- organization_id
- project_id nullable
- conversation_type
- primary_agent_id nullable
- title
- created_at
- archived_at

### `conversation_participants`
- conversation_id
- participant_type `USER|AGENT`
- user_id nullable
- agent_id nullable

### `messages`
- id
- organization_id
- conversation_id
- sender_type
- sender_user_id nullable
- sender_agent_id nullable
- content_json
- provider_metadata nullable
- created_at

Indexes:
- conversation/date;
- Postgres full text extracted content.

### `memories`
- id
- organization_id
- project_id nullable
- agent_id nullable
- memory_type
- title
- content
- importance
- pinned
- source_type nullable
- source_id nullable
- embedding vector nullable
- created_at
- updated_at
- deleted_at

### `decisions`
- id
- organization_id
- project_id
- title
- decision
- rationale
- consequences
- status
- source_meeting_id nullable
- source_message_id nullable
- created_at
- superseded_by nullable

## 10. Meetings

### `meetings`
- id
- organization_id
- project_id
- title
- meeting_type
- agenda_json
- status
- convener_agent_id nullable
- created_by_user_id nullable
- max_rounds
- started_at
- ended_at

### `meeting_participants`
- meeting_id
- agent_id nullable
- user_id nullable
- participant_type

### `meeting_contributions`
- id
- meeting_id
- participant_type
- agent_id nullable
- user_id nullable
- round
- content
- run_id nullable
- created_at

### `meeting_minutes`
- meeting_id PK
- summary
- decisions_json
- action_items_json
- generated_by_agent_id
- approved_at nullable

## 11. Approvals

### `approvals`
- id
- organization_id
- project_id nullable
- approval_type
- requested_by_agent_id nullable
- requested_by_user_id nullable
- subject_type
- subject_id
- status `PENDING|APPROVED|REJECTED|EXPIRED|CANCELED`
- risk_json
- alternatives_json
- expires_at nullable
- resolved_by_user_id nullable
- resolution_note nullable
- created_at
- resolved_at

## 12. Cost/budget

### `cost_ledger`
- id
- organization_id
- project_id nullable
- task_id nullable
- run_id nullable
- meeting_id nullable
- agent_id nullable
- provider_type
- provider_model_id
- currency
- amount
- input_tokens nullable
- cached_input_tokens nullable
- output_tokens nullable
- confidence
- occurred_at

### `budget_policies`
- id
- organization_id
- project_id nullable
- agent_id nullable
- period_type
- soft_limit
- hard_limit
- currency
- action_on_soft
- action_on_hard
- enabled

## 13. Notifications

### `notifications`
- id
- organization_id
- user_id
- category
- severity
- title
- body
- deep_link
- read_at nullable
- created_at

### `push_subscriptions`
- id
- user_id
- endpoint
- p256dh
- auth
- user_agent
- created_at
- revoked_at

## 14. Workers

### `worker_nodes`
- id
- organization_id nullable for platform cloud worker
- node_type `CLOUD|LOCAL`
- name
- status
- credential_hash
- capabilities_json
- allowed_scopes_json
- last_heartbeat_at
- created_at
- revoked_at

### `worker_leases`
- id
- worker_node_id
- task_attempt_id
- lease_expires_at
- renewed_at

## 15. Git/integrations

### `repo_connections`
- id
- organization_id
- provider_type
- repo_owner
- repo_name
- repo_external_id
- encrypted_auth_blob or installation reference
- default_branch
- status
- created_at

### `artifacts`
- id
- organization_id
- project_id nullable
- task_id nullable
- artifact_type
- storage_path
- mime_type
- sha256
- size_bytes
- metadata_json
- created_at

## 16. RLS baseline

Every tenant table:
- SELECT allowed only organization members;
- INSERT/UPDATE/DELETE based on human role and server route;
- agent/worker writes normally use service role through trusted server and application authorization;
- service role never exposed to browser.

RLS tests must create Organization A/B and prove cross-tenant isolation for each public-facing table family.
