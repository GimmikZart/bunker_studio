'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Agent = {
  id: string;
  name: string;
  roleKey: string;
  title: string;
  avatarAssetId: string | null;
  skills: string[];
  tools: string[];
  permissions: string[];
  providerBindingId: string;
  providerConnectionId: string;
  providerType: string;
  providerModelId: string;
  runtimeType: string;
  reasoningEffort: ReasoningEffort;
};
type Provider = {
  id: string;
  displayName: string;
  providerType: string;
  status: string;
  models: string[];
};
type TemplateKey = 'lead' | 'frontend' | 'backend' | 'reviewer' | 'designer' | 'hr' | 'custom';
type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

const AVATARS = [
  { id: '', label: 'Default' },
  { id: '00000000-0000-0000-0000-000000000001', label: 'Amber' },
  { id: '00000000-0000-0000-0000-000000000002', label: 'Cobalt' },
  { id: '00000000-0000-0000-0000-000000000003', label: 'Mint' },
];
const TEMPLATES: Record<
  TemplateKey,
  { label: string; title: string; skills: string[]; tools: string[]; permissions: string[] }
> = {
  lead: {
    label: 'Lead',
    title: 'Lead Architect / Orchestrator',
    skills: ['planning', 'architecture', 'coordination'],
    tools: ['project.read', 'task.plan'],
    permissions: ['task.plan', 'task.assign'],
  },
  frontend: {
    label: 'Frontend',
    title: 'Frontend Engineer',
    skills: ['frontend', 'accessibility', 'testing'],
    tools: ['repository.workspace', 'ci.read'],
    permissions: ['repo.read', 'artifact.write'],
  },
  backend: {
    label: 'Backend',
    title: 'Backend Engineer',
    skills: ['backend', 'api-design', 'testing'],
    tools: ['repository.workspace', 'ci.read'],
    permissions: ['repo.read', 'artifact.write'],
  },
  reviewer: {
    label: 'Reviewer / QA',
    title: 'Reviewer / QA / Security',
    skills: ['review', 'security', 'quality-assurance'],
    tools: ['repository.read', 'ci.read'],
    permissions: ['repo.read'],
  },
  designer: {
    label: 'Designer',
    title: 'Product Designer',
    skills: ['product-design', 'ux', 'design-system'],
    tools: ['design.read', 'artifact.write'],
    permissions: ['design.write', 'artifact.write'],
  },
  hr: {
    label: 'HR',
    title: 'HR / Staffing',
    skills: ['staffing', 'cost-analysis', 'team-design'],
    tools: ['agent.read', 'project.read'],
    permissions: ['agent.recommend'],
  },
  custom: { label: 'Custom', title: '', skills: [], tools: [], permissions: [] },
};

function split(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function AgentCrudPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editingId, setEditingId] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('frontend');
  const [name, setName] = useState('');
  const [roleKey, setRoleKey] = useState('frontend');
  const [title, setTitle] = useState(TEMPLATES.frontend.title);
  const [avatarAssetId, setAvatarAssetId] = useState('');
  const [skills, setSkills] = useState(TEMPLATES.frontend.skills.join(', '));
  const [tools, setTools] = useState(TEMPLATES.frontend.tools.join(', '));
  const [permissions, setPermissions] = useState(TEMPLATES.frontend.permissions.join(', '));
  const [providerConnectionId, setProviderConnectionId] = useState('');
  const [providerModelId, setProviderModelId] = useState('');
  const [runtimeType, setRuntimeType] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(id: string) {
    if (!id) return;
    const [agentsResponse, settingsResponse] = await Promise.all([
      fetch('/api/agents', { headers: apiHeaders(id) }),
      fetch('/api/settings', { headers: apiHeaders(id) }),
    ]);
    if (!agentsResponse.ok || !settingsResponse.ok) {
      setError(
        'We could not load this organization’s agents. Select the organization again or retry.',
      );
      return;
    }
    setAgents(((await agentsResponse.json()) as { agents?: Agent[] }).agents ?? []);
    setProviders(
      (((await settingsResponse.json()) as { providers?: Provider[] }).providers ?? []).filter(
        (provider) => provider.status === 'READY',
      ),
    );
  }
  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const next =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(next);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = next.some((item) => item.id === saved) ? saved! : (next[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected);
      })
      .catch(() => setError('You need an organization before you can manage agents.'));
  }, []);

  function applyTemplate(key: TemplateKey) {
    const template = TEMPLATES[key];
    setTemplateKey(key);
    setRoleKey(key);
    setTitle(template.title);
    setSkills(template.skills.join(', '));
    setTools(template.tools.join(', '));
    setPermissions(template.permissions.join(', '));
  }
  function reset() {
    setEditingId('');
    setName('');
    setAvatarAssetId('');
    setProviderConnectionId('');
    setProviderModelId('');
    setRuntimeType('');
    setReasoningEffort('medium');
    setShowAdvanced(false);
    applyTemplate('frontend');
  }
  function selectOrganization(id: string) {
    setOrganizationId(id);
    window.localStorage.setItem('bunker-organization-id', id);
    reset();
    void load(id);
  }
  function startEdit(agent: Agent) {
    setEditingId(agent.id);
    setName(agent.name);
    const key = Object.keys(TEMPLATES).includes(agent.roleKey)
      ? (agent.roleKey as TemplateKey)
      : 'custom';
    setTemplateKey(key);
    setRoleKey(agent.roleKey);
    setTitle(agent.title);
    setAvatarAssetId(agent.avatarAssetId ?? '');
    setSkills(agent.skills.join(', '));
    setTools(agent.tools.join(', '));
    setPermissions(agent.permissions.join(', '));
    setProviderConnectionId(agent.providerConnectionId);
    setProviderModelId(agent.providerModelId);
    setRuntimeType(agent.runtimeType);
    setReasoningEffort(agent.reasoningEffort);
    setShowAdvanced(true);
    setNotice('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (
      !organizationId ||
      !name.trim() ||
      !title.trim() ||
      !providerConnectionId ||
      !providerModelId ||
      !runtimeType
    ) {
      setError(
        'Enter a name and choose a provider model. The template supplies the remaining safe defaults.',
      );
      return;
    }
    const response = await fetch(editingId ? `/api/agents/${editingId}` : '/api/agents', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        roleKey,
        title,
        avatarAssetId: avatarAssetId || null,
        skills: split(skills),
        tools: split(tools),
        permissions: split(permissions),
        providerConnectionId,
        providerModelId,
        runtimeType,
        reasoningEffort,
        personality: {},
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(
        payload.error ??
          'The agent could not be saved. Check the highlighted choices and try again.',
      );
      return;
    }
    await load(organizationId);
    setNotice(
      editingId
        ? 'Agent updated. Its identity and history are unchanged.'
        : 'Agent created and ready to be assigned to work.',
    );
    reset();
  }
  async function archive(agent: Agent) {
    if (!window.confirm(`Archive ${agent.name}? It will remain recoverable.`)) return;
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: 'DELETE',
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) {
      setError('The agent could not be archived. Please retry.');
      return;
    }
    await load(organizationId);
    setNotice('Agent archived.');
  }
  const selectedProvider = providers.find((provider) => provider.id === providerConnectionId);
  const runtimeChoices = selectedProvider
    ? selectedProvider.providerType === 'OPENAI'
      ? [
          { value: 'OPENAI', label: 'OpenAI API (general purpose)' },
          { value: 'CODEX_SDK', label: 'Codex SDK (repository work)' },
        ]
      : selectedProvider.providerType === 'ANTHROPIC'
        ? [{ value: 'ANTHROPIC', label: 'Anthropic API' }]
        : [{ value: 'OPENAI_COMPATIBLE', label: 'OpenAI-compatible API' }]
    : [];

  function selectProvider(id: string) {
    const provider = providers.find((candidate) => candidate.id === id);
    setProviderConnectionId(id);
    setProviderModelId('');
    setRuntimeType(
      provider?.providerType === 'OPENAI'
        ? 'OPENAI'
        : provider?.providerType === 'ANTHROPIC'
          ? 'ANTHROPIC'
          : provider
            ? 'OPENAI_COMPATIBLE'
            : '',
    );
  }

  return (
    <section className="live-panel" aria-label="Agent management">
      <div className="live-panel-toolbar">
        <label htmlFor="agents-organization">Organization</label>
        <select
          id="agents-organization"
          value={organizationId}
          onChange={(event) => selectOrganization(event.target.value)}
          disabled={!organizations.length}
        >
          {!organizations.length && <option value="">Create an organization first</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      {!organizations.length && (
        <div className="actionable-empty-state">
          <strong>You need an organization before you can create an agent.</strong>
          <span>Organizations keep identities, permissions, and history isolated.</span>
          <Link className="primary-button" href="/onboarding">
            Create an organization
          </Link>
        </div>
      )}
      <form className="resource-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="agent-name">Name</label>
        <input
          id="agent-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          disabled={!organizationId}
          aria-describedby="agent-name-help"
        />
        <p id="agent-name-help" className="field-help">
          This durable name stays with the agent even if you change model or provider later.
        </p>
        <label htmlFor="agent-template">Agent template</label>
        <select
          id="agent-template"
          value={templateKey}
          onChange={(event) => applyTemplate(event.target.value as TemplateKey)}
          disabled={!organizationId}
        >
          {Object.entries(TEMPLATES).map(([key, template]) => (
            <option key={key} value={key}>
              {template.label}
            </option>
          ))}
        </select>
        <p className="field-help">
          Templates pre-fill a safe role, skills, tools, and permissions. Advanced settings remain
          editable.
        </p>
        <label htmlFor="agent-title">Title</label>
        <input
          id="agent-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          disabled={!organizationId}
        />
        <label htmlFor="agent-provider">Provider</label>
        <select
          id="agent-provider"
          value={providerConnectionId}
          onChange={(event) => selectProvider(event.target.value)}
          required
          disabled={!organizationId || !providers.length}
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
        <label htmlFor="agent-model">Model</label>
        <select
          id="agent-model"
          value={providerModelId}
          onChange={(event) => setProviderModelId(event.target.value)}
          required
          disabled={!selectedProvider}
        >
          <option value="">
            {selectedProvider ? 'Choose a model' : 'Choose a provider first'}
          </option>
          {selectedProvider?.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        {!providers.length && (
          <>
            <p className="field-help">
              No ready provider is configured for this organization. Credentials remain server-side
              and are never entered here.
            </p>
            <Link className="secondary-button" href="/settings#providers">
              Configure provider
            </Link>
          </>
        )}
        <label htmlFor="agent-avatar">Avatar</label>
        <select
          id="agent-avatar"
          value={avatarAssetId}
          onChange={(event) => setAvatarAssetId(event.target.value)}
          disabled={!organizationId}
        >
          {AVATARS.map((avatar) => (
            <option key={avatar.id} value={avatar.id}>
              {avatar.label}
            </option>
          ))}
        </select>
        <details
          className="advanced-section"
          open={showAdvanced}
          onToggle={(event) => setShowAdvanced(event.currentTarget.open)}
        >
          <summary>Advanced: capabilities and technical identifiers</summary>
          <label htmlFor="agent-role">Role key</label>
          <input
            id="agent-role"
            value={roleKey}
            onChange={(event) => setRoleKey(event.target.value)}
            required
          />
          <label htmlFor="agent-runtime">Execution runtime</label>
          <select
            id="agent-runtime"
            value={runtimeType}
            onChange={(event) => setRuntimeType(event.target.value)}
            required
            disabled={!selectedProvider}
          >
            {runtimeChoices.map((runtime) => (
              <option key={runtime.value} value={runtime.value}>
                {runtime.label}
              </option>
            ))}
          </select>
          <p className="field-help">
            Choose Codex SDK for agents that must inspect, edit, and test repositories on the PC
            worker. The direct API runtime is suitable for planning, chat, and structured work.
          </p>
          <label htmlFor="agent-reasoning">Reasoning effort</label>
          <select
            id="agent-reasoning"
            value={reasoningEffort}
            onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}
          >
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra high</option>
            <option value="max">Maximum</option>
          </select>
          <label htmlFor="agent-skills">Skills</label>
          <input
            id="agent-skills"
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
          />
          <label htmlFor="agent-tools">Tools</label>
          <input
            id="agent-tools"
            value={tools}
            onChange={(event) => setTools(event.target.value)}
          />
          <label htmlFor="agent-permissions">Permissions</label>
          <input
            id="agent-permissions"
            value={permissions}
            onChange={(event) => setPermissions(event.target.value)}
          />
          <p className="field-help">
            Comma-separated authorized capability identifiers sent to the runtime.
          </p>
        </details>
        <div className="action-row">
          <button
            className="primary-button"
            type="submit"
            disabled={
              !organizationId ||
              !providers.length ||
              !providerConnectionId ||
              !providerModelId ||
              !runtimeType
            }
          >
            {editingId ? 'Save changes' : 'Create agent'}
          </button>
          {editingId && (
            <button className="secondary-button" type="button" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {notice && (
        <p className="live-summary" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="live-records">
        {agents.length === 0 && !error && organizationId && (
          <span className="empty-state">
            No agents yet. Choose a template, provider model, and name above to create the first
            one.
          </span>
        )}
        {agents.map((agent) => (
          <div className="live-record" key={agent.id}>
            <span>
              <strong>{agent.name}</strong>
              <small>
                {agent.title} · {agent.roleKey}
              </small>
            </span>
            <button className="secondary-button" type="button" onClick={() => startEdit(agent)}>
              Edit
            </button>
            <Link className="secondary-button" href={`/agents?agentId=${agent.id}`}>
              Details
            </Link>
            <button className="secondary-button" type="button" onClick={() => void archive(agent)}>
              Archive
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
