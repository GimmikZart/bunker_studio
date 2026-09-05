'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
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
  CapabilityPicker,
  defaultRuntimeFor,
  runtimeChoices,
  type Organization,
  type Provider,
  type ReasoningEffort,
} from './agent-shared';

type TemplateKey = 'lead' | 'frontend' | 'backend' | 'reviewer' | 'designer' | 'hr' | 'custom';

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
 * Hiring one agent, on its own page. Changing an agent that already exists
 * happens in its card, so this form only has to do one thing well.
 */
export function AgentCrudPanel() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadProviders(id: string) {
    if (!id) return;
    const response = await fetch('/api/settings', { headers: apiHeaders(id) });
    if (!response.ok) {
      setError('We could not read this organization’s providers. Select it again or retry.');
      return;
    }
    setProviders(
      (((await response.json()) as { providers?: Provider[] }).providers ?? []).filter(
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
        await loadProviders(selected);
      })
      .catch(() => setError('You need an organization before you can create an agent.'));
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

  function selectOrganization(id: string) {
    setOrganizationId(id);
    window.localStorage.setItem('bunker-organization-id', id);
    setProviderConnectionId('');
    setProviderModelId('');
    setRuntimeType('');
    void loadProviders(id);
  }

  const selectedProvider = providers.find((provider) => provider.id === providerConnectionId);

  function selectProvider(id: string) {
    const provider = providers.find((candidate) => candidate.id === id);
    setProviderConnectionId(id);
    setProviderModelId('');
    setRuntimeType(defaultRuntimeFor(provider));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
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
    setSaving(true);
    const response = await fetch('/api/agents', {
      method: 'POST',
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
    setSaving(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(
        payload.error ??
          'The agent could not be saved. Check the highlighted choices and try again.',
      );
      return;
    }
    router.push('/agents');
  }

  return (
    <section className="live-panel" aria-label="Create an agent">
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
        <Link className="secondary-button" href="/agents">
          Back to agents
        </Link>
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
        <details className="advanced-section">
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
            {runtimeChoices(selectedProvider).map((runtime) => (
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
        {error && (
          <p className="live-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-row">
          <button
            className="primary-button"
            type="submit"
            disabled={
              saving ||
              !organizationId ||
              !providers.length ||
              !providerConnectionId ||
              !providerModelId ||
              !runtimeType
            }
          >
            {saving ? 'Creating…' : 'Create agent'}
          </button>
          <Link className="secondary-button" href="/agents">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
