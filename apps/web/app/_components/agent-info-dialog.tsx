'use client';

import { useEffect, useState } from 'react';
import { FieldLabel } from './help-tip';
import { apiHeaders } from './live-panel';
import {
  PERMISSION_CHOICES,
  ROLE_CHOICES,
  SKILL_SUGGESTIONS,
  TOOL_CHOICES,
} from './agent-capabilities';
import {
  AVATARS,
  AgentAvatar,
  CapabilityPicker,
  defaultRuntimeFor,
  providerLabel,
  REASONING_LABELS,
  runtimeChoices,
  type Agent,
  type Provider,
  type ReasoningEffort,
} from './agent-shared';

type Assignment = {
  id: string;
  teamId: string | null;
  projectId: string | null;
  reportsToAgentId: string | null;
};

type AgentMetrics = {
  tasksCompleted: number;
  firstReviewPassRate: number;
  averageTaskCost: number;
  medianCycleTimeMs: number;
};

function TagList({ values }: { values: string[] }) {
  if (!values.length) return <p className="agent-info-empty">None configured.</p>;
  return (
    <ul className="agent-tag-list">
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  );
}

/**
 * Everything the studio knows about one agent, and the one place to change it.
 * Reading comes first — the fields only become editable once you ask for it, so
 * opening a card to check which model it runs on cannot end in an accidental
 * edit.
 */
export function AgentInfoDialog({
  agent,
  organizationId,
  providers,
  names,
  onClose,
  onSaved,
}: {
  agent: Agent;
  organizationId: string;
  providers: Provider[];
  names: { projects: Map<string, string>; teams: Map<string, string>; agents: Map<string, string> };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(agent.name);
  const [title, setTitle] = useState(agent.title);
  const [roleKey, setRoleKey] = useState(agent.roleKey);
  const [avatarAssetId, setAvatarAssetId] = useState(agent.avatarAssetId ?? '');
  const [providerConnectionId, setProviderConnectionId] = useState(agent.providerConnectionId);
  const [providerModelId, setProviderModelId] = useState(agent.providerModelId);
  const [runtimeType, setRuntimeType] = useState(agent.runtimeType);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(agent.reasoningEffort);
  const [skills, setSkills] = useState<string[]>(agent.skills);
  const [tools, setTools] = useState<string[]>(agent.tools);
  const [permissions, setPermissions] = useState<string[]>(agent.permissions);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let current = true;
    void fetch(`/api/agents/${agent.id}/assignments`, { headers: apiHeaders(organizationId) })
      .then(async (response) => {
        if (!current || !response.ok) return;
        setAssignments(
          ((await response.json()) as { assignments?: Assignment[] }).assignments ?? [],
        );
      })
      .catch(() => undefined);
    void fetch(`/api/agents/${agent.id}/metrics`, { headers: apiHeaders(organizationId) })
      .then(async (response) => {
        if (!current || !response.ok) return;
        setMetrics(((await response.json()) as { metrics?: AgentMetrics }).metrics ?? null);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [agent.id, organizationId]);

  const selectedProvider = providers.find((provider) => provider.id === providerConnectionId);
  const currentProvider = providers.find((provider) => provider.id === agent.providerConnectionId);

  function cancelEdit() {
    setName(agent.name);
    setTitle(agent.title);
    setRoleKey(agent.roleKey);
    setAvatarAssetId(agent.avatarAssetId ?? '');
    setProviderConnectionId(agent.providerConnectionId);
    setProviderModelId(agent.providerModelId);
    setRuntimeType(agent.runtimeType);
    setReasoningEffort(agent.reasoningEffort);
    setSkills(agent.skills);
    setTools(agent.tools);
    setPermissions(agent.permissions);
    setError('');
    setEditing(false);
  }

  async function save() {
    if (!name.trim() || !title.trim() || !roleKey.trim() || !providerModelId || !runtimeType) {
      setError('A name, a title, a role and a provider model are required.');
      return;
    }
    setSaving(true);
    setError('');
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        roleKey,
        title,
        avatarAssetId: avatarAssetId || null,
        skills,
        tools,
        permissions,
        providerConnectionId,
        providerModelId,
        runtimeType,
        reasoningEffort,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? 'The changes could not be saved.');
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function archive() {
    if (!window.confirm(`Archive ${agent.name}? It will remain recoverable.`)) return;
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: 'DELETE',
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) {
      setError('The agent could not be archived. Please retry.');
      return;
    }
    onSaved();
    onClose();
  }

  function describeAssignment(assignment: Assignment): string {
    const parts = [
      assignment.projectId &&
        `Project: ${names.projects.get(assignment.projectId) ?? assignment.projectId}`,
      assignment.teamId && `Team: ${names.teams.get(assignment.teamId) ?? assignment.teamId}`,
      assignment.reportsToAgentId &&
        `Reports to ${names.agents.get(assignment.reportsToAgentId) ?? assignment.reportsToAgentId}`,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <section
        aria-label={`${agent.name} details`}
        aria-modal="true"
        className="info-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="info-dialog-head">
          <AgentAvatar agent={{ name, avatarAssetId }} size="small" />
          <span className="chat-drawer-identity">
            <strong>{editing ? 'Editing' : name}</strong>
            <small>{title}</small>
          </span>
          <button
            aria-label="Close the agent details"
            className="drawer-close"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </header>

        <div className="info-dialog-body">
          {!editing ? (
            <>
              <dl className="agent-info-grid">
                <div>
                  <dt>Role key</dt>
                  <dd>{agent.roleKey}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>
                    {currentProvider?.displayName ?? providerLabel(agent.providerType)}
                    <small> · {providerLabel(agent.providerType)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{agent.providerModelId}</dd>
                </div>
                <div>
                  <dt>Reasoning</dt>
                  <dd>{REASONING_LABELS[agent.reasoningEffort]}</dd>
                </div>
                <div>
                  <dt>Runtime</dt>
                  <dd>{agent.runtimeType}</dd>
                </div>
                <div>
                  <dt>Avatar</dt>
                  <dd>
                    {AVATARS.find((avatar) => avatar.id === (agent.avatarAssetId ?? ''))?.label ??
                      'Default'}
                  </dd>
                </div>
              </dl>
              {metrics && (
                <p className="live-summary">
                  {metrics.tasksCompleted} tasks done ·{' '}
                  {(metrics.firstReviewPassRate * 100).toFixed(0)}% first-pass review · $
                  {metrics.averageTaskCost.toFixed(2)} average cost
                </p>
              )}
              <h3>Skills</h3>
              <TagList values={agent.skills} />
              <h3>Tools</h3>
              <TagList values={agent.tools} />
              <h3>Permissions</h3>
              <TagList values={agent.permissions} />
              <h3>Assignments</h3>
              {assignments.length === 0 ? (
                <p className="agent-info-empty">
                  No active assignment. Put this agent on a project to give it work.
                </p>
              ) : (
                <ul className="agent-tag-list agent-assignment-list">
                  {assignments.map((assignment) => (
                    <li key={assignment.id}>{describeAssignment(assignment)}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="resource-form">
              <label htmlFor="edit-agent-name">Name</label>
              <input
                id="edit-agent-name"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <label htmlFor="edit-agent-title">Title</label>
              <input
                id="edit-agent-title"
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
              <FieldLabel
                htmlFor="edit-agent-role"
                help="The role decides what the studio routes to this agent on its own — only an agent whose role is reviewer can produce a review."
              >
                Role key
              </FieldLabel>
              <select
                id="edit-agent-role"
                onChange={(event) =>
                  setRoleKey(event.target.value === 'custom' ? '' : event.target.value)
                }
                value={ROLE_CHOICES.some((role) => role.id === roleKey) ? roleKey : 'custom'}
              >
                {ROLE_CHOICES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label} — {role.description}
                  </option>
                ))}
                <option value="custom">Custom role key…</option>
              </select>
              {!ROLE_CHOICES.some((role) => role.id === roleKey) && (
                <input
                  aria-label="Custom role key"
                  onChange={(event) => setRoleKey(event.target.value)}
                  placeholder="for example: data-engineer"
                  value={roleKey}
                />
              )}
              <label htmlFor="edit-agent-avatar">Avatar</label>
              <select
                id="edit-agent-avatar"
                onChange={(event) => setAvatarAssetId(event.target.value)}
                value={avatarAssetId}
              >
                {AVATARS.map((avatar) => (
                  <option key={avatar.id} value={avatar.id}>
                    {avatar.label}
                  </option>
                ))}
              </select>
              <FieldLabel
                htmlFor="edit-agent-provider"
                help="Changing the provider keeps the agent, its name and everything it has learned. Only the AI behind it changes."
              >
                Provider
              </FieldLabel>
              <select
                id="edit-agent-provider"
                onChange={(event) => {
                  const provider = providers.find(
                    (candidate) => candidate.id === event.target.value,
                  );
                  setProviderConnectionId(event.target.value);
                  setProviderModelId('');
                  setRuntimeType(defaultRuntimeFor(provider));
                }}
                value={providerConnectionId}
              >
                <option value="">
                  {providers.length ? 'Choose a provider' : 'No provider available'}
                </option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.displayName} · {provider.providerType}
                  </option>
                ))}
              </select>
              <label htmlFor="edit-agent-model">Model</label>
              <select
                disabled={!selectedProvider}
                id="edit-agent-model"
                onChange={(event) => setProviderModelId(event.target.value)}
                value={providerModelId}
              >
                <option value="">
                  {selectedProvider ? 'Choose a model' : 'Choose a provider first'}
                </option>
                {selectedProvider?.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                {selectedProvider &&
                  !selectedProvider.models.includes(providerModelId) &&
                  providerModelId && <option value={providerModelId}>{providerModelId}</option>}
              </select>
              <label htmlFor="edit-agent-runtime">Execution runtime</label>
              <select
                disabled={!selectedProvider}
                id="edit-agent-runtime"
                onChange={(event) => setRuntimeType(event.target.value)}
                value={runtimeType}
              >
                {runtimeChoices(selectedProvider).map((runtime) => (
                  <option key={runtime.value} value={runtime.value}>
                    {runtime.label}
                  </option>
                ))}
              </select>
              <label htmlFor="edit-agent-reasoning">Reasoning effort</label>
              <select
                id="edit-agent-reasoning"
                onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}
                value={reasoningEffort}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">Extra high</option>
                <option value="max">Maximum</option>
              </select>
              <CapabilityPicker
                addLabel="Add a skill of your own"
                choices={SKILL_SUGGESTIONS.map((skill) => ({
                  id: skill,
                  label: skill,
                  description: '',
                }))}
                legend="Skills"
                name="edit-agent-skills"
                onChange={setSkills}
                selected={skills}
              />
              <CapabilityPicker
                addLabel="Add a tool identifier"
                choices={TOOL_CHOICES}
                legend="Tools"
                name="edit-agent-tools"
                onChange={setTools}
                selected={tools}
              />
              <CapabilityPicker
                addLabel="Add a permission identifier"
                choices={PERMISSION_CHOICES}
                legend="Permissions"
                name="edit-agent-permissions"
                onChange={setPermissions}
                selected={permissions}
              />
              <button className="link-button" onClick={() => void archive()} type="button">
                Archive this agent
              </button>
            </div>
          )}
          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="info-dialog-footer">
          <button
            className="secondary-button"
            onClick={editing ? cancelEdit : onClose}
            type="button"
          >
            {editing ? 'Cancel' : 'Close'}
          </button>
          {editing ? (
            <button
              className="primary-button"
              disabled={saving}
              onClick={() => void save()}
              type="button"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          ) : (
            <button className="primary-button" onClick={() => setEditing(true)} type="button">
              Edit
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
