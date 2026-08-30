# Bunker Studio — Agent Runtime & Orchestration Specification

## 1. Agent identity

An Agent is persistent business state:

- `agent_id`;
- name;
- avatar;
- role;
- title;
- personality;
- instructions;
- skills;
- tools;
- permissions;
- memory namespace;
- cost policy;
- autonomy policy;
- reporting line;
- provider binding version.

It is not a permanently running process.

## 2. Runtime session

A runtime session is replaceable:
- provider;
- model;
- external session/thread ID;
- worker;
- workspace;
- context snapshot;
- start/end.

An agent can have many sessions.

## 3. Agent role contracts

### Lead

Input:
- project goal/spec;
- current state;
- eligible tasks;
- dependencies;
- team capability;
- budget/policy;
- reviewer findings.

Output schema:
- decision summary;
- new tasks;
- dependencies;
- assignment;
- read/write scopes;
- parallel groups;
- verification requirements;
- approval requests;
- escalation requirements.

Lead cannot directly mark a task DONE.

### Frontend Engineer

Input:
- bounded task;
- repository context;
- approved design version when required;
- API contract;
- write scope;
- tests/DoD.

Output:
- implementation summary;
- changed files;
- verification;
- blockers;
- handoff.

### Backend Engineer

Same pattern with backend/database/security constraints.

### Reviewer

Input:
- immutable diff/SHA;
- spec requirements;
- CI/security evidence.

Output:
- structured findings;
- pass/fail recommendation.

Read-only.

### Designer

Input:
- product brief;
- design system;
- target screens/states;
- constraints.

Output:
- design proposal variants;
- preview artifacts;
- structured design spec;
- rationale.

### HR

Input:
- project description;
- budget;
- expected workload;
- available provider/model catalog;
- existing agents.

Output:
- staffing proposal;
- role/binding/effort/skills/tools;
- cost class;
- rationale.

## 4. Task state machine

Allowed states:

`DRAFT`
→ `READY`
→ `QUEUED`
→ `RUNNING`

From `RUNNING`:
- `WAITING_DEPENDENCY`;
- `WAITING_APPROVAL`;
- `WAITING_PROVIDER_QUOTA`;
- `WAITING_BUDGET_APPROVAL`;
- `BLOCKED`;
- `IMPLEMENTED`;
- `FAILED_RETRYABLE`;
- `FAILED_FINAL`;
- `CANCELED`.

`IMPLEMENTED`
→ `VERIFYING`
→ `REVIEW_PENDING`
→ `FIX_REQUIRED` or `DONE`.

`FIX_REQUIRED`
→ new linked fix task(s) → review cycle.

Only control plane writes state transitions.

## 5. Workflow state

Project workflow statuses:
- `IDLE`;
- `PLANNING`;
- `EXECUTING`;
- `WAITING_HUMAN`;
- `WAITING_RESOURCE`;
- `REVIEWING`;
- `BLOCKED`;
- `COMPLETED`;
- `CANCELED`.

Derived from tasks/runs; never maintained by chat text.

## 6. Eligibility scheduler

A task is eligible if:
- state `READY`;
- all dependencies `DONE`;
- no unresolved mandatory approval;
- budget allows;
- assigned agent/runtime available;
- project not paused;
- concurrency limit permits;
- write conflict policy passes.

Scheduler runs:
- on relevant domain event;
- periodic reconciliation every minute.

Periodic reconciliation is safety net, not primary event path.

## 7. Parallelism algorithm

1. Build DAG of READY tasks.
2. Filter dependencies.
3. Group by repository.
4. Compare declared `write_scope`.
5. Tasks with disjoint write scopes may share `parallel_group`.
6. Overlap defaults to serialization unless Lead explicitly supplies merge strategy and separate workspaces.
7. All concurrent write tasks use separate branches/workspaces regardless.

Maximum concurrent agents per project is configurable; default 2 writing agents + 1 read-only reviewer/designer/analysis job when budget permits.

## 8. Autonomous loop

Pseudo-flow:

```text
workflow event
→ deterministic scheduler
→ if plan required: invoke Lead
→ validate structured Lead output
→ persist tasks
→ schedule eligible workers
→ workers complete
→ deterministic verification
→ Reviewer if gate required
→ if findings: invoke Lead or direct fix routing according to policy
→ schedule fixes
→ repeat
→ if all scope complete: release candidate
→ human gate only if policy requires
```

No step requires user to type "continue".

## 9. Retry categories

`TRANSIENT_NETWORK`
- 3 quick retries with backoff.

`RATE_LIMIT_TEMPORARY`
- use retry-after; delayed retry.

`QUOTA_EXHAUSTED_RESETTABLE`
- persist and pause until availability probe succeeds.

`CREDITS_EXHAUSTED`
- notify/pause unless approved fallback exists.

`AUTH_ERROR`
- pause provider connection; notify.

`TOOL_FAILURE_RETRYABLE`
- task-local retry max configurable.

`IMPLEMENTATION_FAILURE`
- same worker max 2 attempts before escalation.

`POLICY_BLOCK`
- no retry until state changes.

## 10. Resume payload

Persist:
- task ID;
- run ID;
- attempt;
- agent ID;
- provider binding version;
- external session ID;
- external run ID where available;
- base/candidate commit;
- workspace artifact references;
- last structured handoff;
- last normalized event cursor if runtime supports;
- retry reason;
- `next_retry_at`.

On resume:
1. validate provider binding still allowed;
2. validate task not canceled;
3. re-check budget;
4. probe provider;
5. use native resume if supported;
6. otherwise spawn a new session with handoff context.

## 11. Context builder

Priority:
1. system/role policy;
2. current task/DoD;
3. explicit specification slices;
4. dependency outputs;
5. approved decisions;
6. scoped retrieved memory;
7. bounded recent conversation;
8. summaries.

Each item records token estimate and source.

Context builder must expose debug metadata to owner/admin without exposing hidden provider reasoning.

## 12. Meeting orchestration

Meeting is a workflow, not a shared unbounded chat.

Default:
1. Lead opening statement/agenda.
2. Participant contributions, parallel where independent.
3. Lead receives distilled contributions.
4. Optional second response round.
5. Lead minutes.
6. deterministic parser validates decision/action schema.
7. proposed tasks require normal policy.

## 13. Personality

Personality consists of:
- communication tone;
- decision style;
- collaboration behavior;
- priorities;
- explicit anti-patterns.

Personality must not:
- override security;
- override role scope;
- lower verification requirements;
- invent fake personal history.

## 14. Cost accounting

Every runtime event that exposes usage updates a pending ledger.
Final result reconciles:
- input tokens;
- cached input;
- output tokens;
- tool/runtime cost if known;
- provider reported total;
- Studio estimate if provider total unavailable.

Cost confidence:
`PROVIDER_REPORTED | CALCULATED | ESTIMATED | UNKNOWN`.

## 15. Provider fallback

Fallback candidate must satisfy:
- capability requirements;
- data residency/privacy policy if configured;
- max cost tier;
- role quality floor;
- tool/runtime support.

User can disable fallback globally/project/agent.

Security reviewer default: no silent quality-tier downgrade.

## 16. Model catalog

Model catalog is data, not enum compiled into UI.

Fields:
- provider;
- model ID;
- display name;
- status;
- capabilities;
- cost metadata;
- context limit;
- supported reasoning levels;
- runtime compatibility;
- fetched_at;
- source.

Manual override supported for local models.
