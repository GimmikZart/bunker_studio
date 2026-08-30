'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Agent = {
  id: string;
  name: string;
  roleKey: string;
  title: string;
  providerBindingId: string;
};

export function AgentCrudPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [title, setTitle] = useState('');
  const [providerBindingId, setProviderBindingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextOrganizationId: string) {
    if (!nextOrganizationId) return;
    const response = await fetch('/api/agents', { headers: apiHeaders(nextOrganizationId) });
    if (!response.ok) {
      setError('Could not load agents for this organization.');
      return;
    }
    const payload = (await response.json()) as { agents?: Agent[] };
    setAgents(payload.agents ?? []);
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organization');
        const payload = (await response.json()) as { organizations?: Organization[] };
        const next = payload.organizations ?? [];
        setOrganizations(next);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = next.some((item) => item.id === saved) ? saved! : (next[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected);
      })
      .catch(() => setError('Create or select an organization to manage agents.'));
  }, []);

  function resetForm() {
    setEditingId('');
    setName('');
    setRoleKey('');
    setTitle('');
    setProviderBindingId('');
  }

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    resetForm();
    void load(value);
  }

  function startEdit(agent: Agent) {
    setEditingId(agent.id);
    setName(agent.name);
    setRoleKey(agent.roleKey);
    setTitle(agent.title);
    setProviderBindingId(agent.providerBindingId);
    setNotice('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setError('');
    setNotice('');
    const response = await fetch(editingId ? `/api/agents/${editingId}` : '/api/agents', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ name, roleKey, title, providerBindingId, personality: {} }),
    });
    if (!response.ok) {
      setError('The agent could not be saved.');
      return;
    }
    await load(organizationId);
    setNotice(editingId ? 'Agent updated.' : 'Agent created.');
    resetForm();
  }

  async function archive(agent: Agent) {
    if (!window.confirm(`Archive ${agent.name}? It will remain recoverable.`)) return;
    setError('');
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: 'DELETE',
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) {
      setError('The agent could not be archived.');
      return;
    }
    await load(organizationId);
    setNotice('Agent archived.');
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
          {!organizations.length && <option value="">No organizations</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      <form className="resource-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="agent-name">Name</label>
        <input
          id="agent-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
        />
        <label htmlFor="agent-role">Role key</label>
        <input
          id="agent-role"
          value={roleKey}
          onChange={(event) => setRoleKey(event.target.value)}
          required
        />
        <label htmlFor="agent-title">Title</label>
        <input
          id="agent-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <label htmlFor="agent-provider">Provider binding label</label>
        <input
          id="agent-provider"
          value={providerBindingId}
          onChange={(event) => setProviderBindingId(event.target.value)}
          placeholder="local-ollama or provider label"
          required
        />
        <p className="field-help">
          Use a binding label; API keys remain server-side and are never shown here.
        </p>
        <div className="action-row">
          <button className="primary-button" type="submit" disabled={!organizationId}>
            {editingId ? 'Save changes' : 'Create agent'}
          </button>
          {editingId && (
            <button className="secondary-button" type="button" onClick={resetForm}>
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
        {agents.length === 0 && !error && (
          <span className="empty-state">Nothing recorded yet.</span>
        )}
        {agents.map((agent) => (
          <div className="live-record" key={agent.id}>
            <span>
              <strong>{agent.name}</strong>
              <small>
                {agent.title} · {agent.roleKey} · {agent.providerBindingId}
              </small>
            </span>
            <button className="secondary-button" type="button" onClick={() => startEdit(agent)}>
              Edit
            </button>
            <button className="secondary-button" type="button" onClick={() => void archive(agent)}>
              Archive
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
