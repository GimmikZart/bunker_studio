'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Project = { id: string; name: string };
type Provider = {
  id: string;
  displayName: string;
  providerType: string;
  status: string;
  models: string[];
};
type Proposal = {
  roleKey: string;
  title: string;
  modelTier: string;
  skills: string[];
  tools: string[];
  estimatedCost: number;
  rationale: string;
};
type Hire = Proposal & {
  name: string;
  providerConnectionId: string;
  providerModelId: string;
  runtimeType: 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE' | 'CODEX_SDK';
  reasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
};

const roles = ['lead', 'frontend', 'backend', 'reviewer', 'designer', 'hr'];
const split = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const runtimeFor = (provider?: Provider): Hire['runtimeType'] =>
  provider?.providerType === 'ANTHROPIC'
    ? 'ANTHROPIC'
    : provider?.providerType === 'OPENAI'
      ? 'OPENAI'
      : 'OPENAI_COMPATIBLE';

export function TeamBuilderPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [goal, setGoal] = useState('');
  const [projectId, setProjectId] = useState('');
  const [budget, setBudget] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [requiredRoles, setRequiredRoles] = useState<string[]>([
    'lead',
    'frontend',
    'backend',
    'reviewer',
  ]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(id: string) {
    if (!id) return;
    const [projectsResponse, settingsResponse] = await Promise.all([
      fetch(`/api/organizations/${id}/projects`, { headers: apiHeaders(id) }),
      fetch('/api/settings', { headers: apiHeaders(id) }),
    ]);
    if (!projectsResponse.ok || !settingsResponse.ok) throw new Error('load');
    setProjects(((await projectsResponse.json()) as { projects?: Project[] }).projects ?? []);
    setProviders(
      (((await settingsResponse.json()) as { providers?: Provider[] }).providers ?? []).filter(
        (provider) => provider.status === 'READY',
      ),
    );
  }
  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organizations');
        const values =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(values);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const id = values.some((item) => item.id === saved) ? saved! : (values[0]?.id ?? '');
        setOrganizationId(id);
        await load(id);
      })
      .catch(() => setError('Create an organization before building a team.'));
  }, []);
  function toggleRole(role: string) {
    setRequiredRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role],
    );
  }
  async function propose() {
    if (!organizationId || !goal.trim()) return setError('Describe the team objective first.');
    setError('');
    const response = await fetch('/api/staffing/proposals', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        goal,
        ...(projectId ? { projectId } : {}),
        requiredRoles,
        capabilities: split(capabilities),
        ...(budget ? { budget: Number(budget) } : {}),
      }),
    });
    if (!response.ok) return setError('The staffing proposal could not be generated.');
    const proposals = ((await response.json()) as { proposals: Proposal[] }).proposals;
    setHires(
      proposals.map((proposal) => ({
        ...proposal,
        name: proposal.title,
        providerConnectionId: '',
        providerModelId: '',
        runtimeType: 'OPENAI_COMPATIBLE',
        reasoningEffort: proposal.modelTier === 'PREMIUM_REASONER' ? 'high' : 'medium',
      })),
    );
    setNotice('Review and edit every proposed hire, then explicitly confirm the team.');
  }
  function updateHire(index: number, patch: Partial<Hire>) {
    setHires((current) =>
      current.map((hire, position) => (position === index ? { ...hire, ...patch } : hire)),
    );
  }
  async function confirm() {
    if (!organizationId || !hires.length) return;
    if (
      hires.some((hire) => !hire.name.trim() || !hire.providerConnectionId || !hire.providerModelId)
    )
      return setError('Choose a provider and model for every hire before confirmation.');
    const response = await fetch('/api/staffing/confirm', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        confirmed: true,
        agents: hires.map((hire) => ({
          name: hire.name,
          roleKey: hire.roleKey,
          title: hire.title,
          skills: hire.skills,
          tools: hire.tools,
          permissions:
            hire.roleKey === 'reviewer' ? ['repo.read'] : ['repo.read', 'artifact.write'],
          providerConnectionId: hire.providerConnectionId,
          providerModelId: hire.providerModelId,
          runtimeType: hire.runtimeType,
          reasoningEffort: hire.reasoningEffort,
          personality: {},
        })),
      }),
    });
    if (!response.ok)
      return setError('The team could not be confirmed. Check the selected bindings.');
    setHires([]);
    setNotice('Team hired. Each agent can now be edited or assigned from Agents.');
  }
  return (
    <section className="live-panel" aria-label="New team builder">
      <div className="live-panel-toolbar">
        <label htmlFor="team-org">Organization</label>
        <select
          id="team-org"
          value={organizationId}
          onChange={(event) => {
            setOrganizationId(event.target.value);
            window.localStorage.setItem('bunker-organization-id', event.target.value);
            void load(event.target.value);
          }}
        >
          <option value="">Choose an organization</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      <div className="resource-form">
        <label htmlFor="team-goal">Team objective</label>
        <textarea
          id="team-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="What must this team deliver?"
        />
        <label htmlFor="team-project">Project (optional)</label>
        <select
          id="team-project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">No project yet</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <label htmlFor="team-budget">Budget cap (optional)</label>
        <input
          id="team-budget"
          type="number"
          min="0"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
        />
        <label htmlFor="team-capabilities">Required capabilities (comma-separated)</label>
        <input
          id="team-capabilities"
          value={capabilities}
          onChange={(event) => setCapabilities(event.target.value)}
          placeholder="accessibility, API design"
        />
        <fieldset>
          <legend>Suggested roles</legend>
          {roles.map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={requiredRoles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              {role}
            </label>
          ))}
        </fieldset>
        <button
          className="primary-button"
          type="button"
          onClick={() => void propose()}
          disabled={!organizationId}
        >
          Propose team
        </button>
      </div>
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
      {hires.map((hire, index) => {
        const provider = providers.find((item) => item.id === hire.providerConnectionId);
        return (
          <div className="live-record" key={`${hire.roleKey}-${index}`}>
            <strong>
              {hire.title} · {hire.modelTier} · estimated {hire.estimatedCost}
            </strong>
            <p>{hire.rationale}</p>
            <label>
              Name
              <input
                value={hire.name}
                onChange={(event) => updateHire(index, { name: event.target.value })}
              />
            </label>
            <label>
              Provider
              <select
                value={hire.providerConnectionId}
                onChange={(event) => {
                  const selected = providers.find((item) => item.id === event.target.value);
                  updateHire(index, {
                    providerConnectionId: event.target.value,
                    providerModelId: '',
                    runtimeType: runtimeFor(selected),
                  });
                }}
              >
                <option value="">Choose provider</option>
                {providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                value={hire.providerModelId}
                onChange={(event) => updateHire(index, { providerModelId: event.target.value })}
              >
                <option value="">Choose model</option>
                {provider?.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reasoning
              <select
                value={hire.reasoningEffort}
                onChange={(event) =>
                  updateHire(index, {
                    reasoningEffort: event.target.value as Hire['reasoningEffort'],
                  })
                }
              >
                {['none', 'low', 'medium', 'high', 'xhigh', 'max'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                setHires((current) => current.filter((_, position) => position !== index))
              }
            >
              Remove hire
            </button>
          </div>
        );
      })}
      {hires.length > 0 && (
        <button className="primary-button" type="button" onClick={() => void confirm()}>
          Confirm and hire team
        </button>
      )}
      <p className="field-help">
        No recommendation creates an agent until you press Confirm and hire team.{' '}
        <Link href="/agents">Create one manually instead.</Link>
      </p>
    </section>
  );
}
