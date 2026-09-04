'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FieldLabel } from './help-tip';
import { apiHeaders } from './live-panel';
import {
  PERMISSION_CHOICES,
  ROLE_CHOICES,
  SKILL_SUGGESTIONS,
  TOOL_CHOICES,
  type Choice,
} from './agent-capabilities';

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

/**
 * A capability list as choices rather than a text box. The identifiers mean
 * something to the studio, so guessing them should not be part of creating an
 * agent — while anything you add yourself is still accepted.
 */
function CapabilityPicker({
  legend,
  name,
  choices,
  selected,
  onChange,
  addLabel,
}: {
  legend: React.ReactNode;
  name: string;
  choices: Choice[];
  selected: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  const [custom, setCustom] = useState('');
  const extras = selected.filter((value) => !choices.some((choice) => choice.id === value));

  function toggle(value: string, checked: boolean) {
    onChange(
      checked ? [...new Set([...selected, value])] : selected.filter((item) => item !== value),
    );
  }

  return (
    <fieldset className="capability-picker">
      <legend>{legend}</legend>
      <div className="capability-options">
        {choices.map((choice) => (
          <label className="capability-option" key={choice.id}>
            <input
              type="checkbox"
              name={name}
              value={choice.id}
              checked={selected.includes(choice.id)}
              onChange={(event) => toggle(choice.id, event.target.checked)}
            />
            <span>
              <strong>{choice.label}</strong>
              <small>{choice.description}</small>
            </span>
          </label>
        ))}
        {extras.map((value) => (
          <label className="capability-option" key={value}>
            <input
              type="checkbox"
              name={name}
              value={value}
              checked
              onChange={(event) => toggle(value, event.target.checked)}
            />
            <span>
              <strong>{value}</strong>
              <small>Added by you.</small>
            </span>
          </label>
        ))}
      </div>
      <div className="capability-add">
        <input
          id={`${name}-add`}
          aria-label={addLabel}
          placeholder={addLabel}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (!custom.trim()) return;
            onChange([...new Set([...selected, custom.trim()])]);
            setCustom('');
          }}
        />
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            if (!custom.trim()) return;
            onChange([...new Set([...selected, custom.trim()])]);
            setCustom('');
          }}
        >
          Add
        </button>
      </div>
    </fieldset>
  );
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
  const [skills, setSkills] = useState<string[]>(TEMPLATES.frontend.skills);
  const [tools, setTools] = useState<string[]>(TEMPLATES.frontend.tools);
  const [permissions, setPermissions] = useState<string[]>(TEMPLATES.frontend.permissions);
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
    setSkills([...template.skills]);
    setTools([...template.tools]);
    setPermissions([...template.permissions]);
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
    setSkills([...agent.skills]);
    setTools([...agent.tools]);
    setPermissions([...agent.permissions]);
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
        skills,
        tools,
        permissions,
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
        <FieldLabel
          htmlFor="agent-template"
          help="A starting point for a common studio role. It fills in the title and typical skills for you; you can change anything afterwards."
        >
          Agent template
        </FieldLabel>
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
        <FieldLabel
          htmlFor="agent-provider"
          help="Which AI account this agent uses. Each agent can use a different one, so you can put a stronger model where it matters and a cheaper one elsewhere."
        >
          Provider
        </FieldLabel>
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
        <FieldLabel
          htmlFor="agent-model"
          help="The specific model from that account. Stronger models reason better and cost more; lighter ones are fine for routine work."
        >
          Model
        </FieldLabel>
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
          <FieldLabel
            htmlFor="agent-role"
            help={
              <>
                <span>
                  The one field here that changes what the studio does on its own. A review of a
                  candidate branch can only be produced by an agent whose role is{' '}
                  <strong>reviewer</strong>, and the office view groups agents by role.
                </span>
                <span>
                  Choose the closest role. A custom role is accepted, but nothing routes work to it
                  automatically — you assign its tasks yourself.
                </span>
              </>
            }
          >
            Role key
          </FieldLabel>
          <select
            id="agent-role"
            value={ROLE_CHOICES.some((role) => role.id === roleKey) ? roleKey : 'custom'}
            onChange={(event) =>
              setRoleKey(event.target.value === 'custom' ? '' : event.target.value)
            }
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
              placeholder="for example: data-engineer"
              value={roleKey}
              onChange={(event) => setRoleKey(event.target.value)}
              required
            />
          )}
          <FieldLabel
            htmlFor="agent-runtime"
            help="How this agent runs. Most agents just talk to the provider. Choose the coding runtime only for an agent that must open your repository and change files."
          >
            Execution runtime
          </FieldLabel>
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
          <FieldLabel
            htmlFor="agent-reasoning"
            help="How long the model is allowed to think before answering. More effort means better decisions on hard problems and a higher cost per answer."
          >
            Reasoning effort
          </FieldLabel>
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
          <CapabilityPicker
            legend={
              <FieldLabel
                htmlFor="agent-skills-add"
                help={
                  <>
                    <span>
                      Free text, in your own words: what this agent is good at. Skills travel with
                      every run the agent performs, alongside the task, so the model knows what it
                      was hired for.
                    </span>
                    <span>
                      They are descriptive. Nothing refuses a task because a skill is missing, so
                      write what is true rather than what you think unlocks something.
                    </span>
                    <span>
                      Examples: <code>frontend</code>, <code>api-design</code>,{' '}
                      <code>accessibility</code>, <code>migrazioni-postgres</code>.
                    </span>
                  </>
                }
              >
                Skills
              </FieldLabel>
            }
            name="agent-skills"
            choices={SKILL_SUGGESTIONS.map((skill) => ({
              id: skill,
              label: skill,
              description: '',
            }))}
            selected={skills}
            onChange={setSkills}
            addLabel="Add a skill of your own"
          />
          <CapabilityPicker
            legend={
              <FieldLabel
                htmlFor="agent-tools-add"
                help={
                  <>
                    <span>
                      What kind of work this agent is set up to do, stated to the runtime with each
                      run. The identifiers below are the ones the studio itself uses; anything else
                      is accepted but means nothing to it.
                    </span>
                    <span>
                      This is a declaration, not a key. What an agent can actually reach is decided
                      elsewhere: the read and write scope of each task, the approval gates, and what
                      the GitHub token connected to the project is allowed to do.
                    </span>
                    <span>Unsure? Leave it as the template set it.</span>
                  </>
                }
              >
                Tools
              </FieldLabel>
            }
            name="agent-tools"
            choices={TOOL_CHOICES}
            selected={tools}
            onChange={setTools}
            addLabel="Add a tool identifier"
          />
          <CapabilityPicker
            legend={
              <FieldLabel
                htmlFor="agent-permissions-add"
                help={
                  <>
                    <span>
                      What this agent is expected to touch, stated to the runtime with each run —
                      the intent you are recording, not a lock.
                    </span>
                    <span>
                      The limits that hold are the task read and write scope enforced by the worker,
                      the approval gates before anything is published, and the permissions of the
                      GitHub token itself. Removing a permission here does not stop an agent; it
                      only stops describing it.
                    </span>
                  </>
                }
              >
                Permissions
              </FieldLabel>
            }
            name="agent-permissions"
            choices={PERMISSION_CHOICES}
            selected={permissions}
            onChange={setPermissions}
            addLabel="Add a permission identifier"
          />
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
