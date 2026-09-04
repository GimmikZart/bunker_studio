'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FieldLabel } from './help-tip';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type RecordItem = { id: string; name: string; description?: string; slug?: string };

export function OrganizationCrudPanel({ kind }: { kind: 'projects' | 'teams' }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryProjectId, setRepositoryProjectId] = useState('');
  const [repositoryOwner, setRepositoryOwner] = useState('');
  const [repositoryName, setRepositoryName] = useState('');
  const [repositoryBranch, setRepositoryBranch] = useState('main');
  const [repositoryToken, setRepositoryToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const endpoint = organizationId ? `/api/organizations/${organizationId}/${kind}` : '';

  async function load(nextOrganizationId: string) {
    if (!nextOrganizationId) return;
    const response = await fetch(`/api/organizations/${nextOrganizationId}/${kind}`, {
      headers: apiHeaders(nextOrganizationId),
    });
    if (!response.ok) {
      setError('Could not load this organization.');
      return;
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const nextRecords = (payload[kind] ?? []) as RecordItem[];
    setRecords(nextRecords);
    if (kind === 'projects')
      setRepositoryProjectId((current) =>
        nextRecords.some((record) => record.id === current) ? current : (nextRecords[0]?.id ?? ''),
      );
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
      .catch(() => setError('Create or select an organization to manage this resource.'));
  }, [kind]);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    setEditingId('');
    setName('');
    setDescription('');
    void load(value);
  }

  function startEdit(record: RecordItem) {
    setEditingId(record.id);
    setName(record.name);
    setDescription(record.description ?? '');
    setNotice('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!endpoint) return;
    setError('');
    setNotice('');
    const response = await fetch(
      editingId
        ? `${endpoint}?${kind === 'projects' ? 'projectId' : 'teamId'}=${editingId}`
        : endpoint,
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
        body: JSON.stringify({ name, description }),
      },
    );
    if (!response.ok) {
      setError('The resource could not be saved.');
      return;
    }
    await load(organizationId);
    setNotice(editingId ? 'Updated.' : 'Created.');
    setEditingId('');
    setName('');
    setDescription('');
  }

  async function archive(record: RecordItem) {
    if (!window.confirm(`Archive ${record.name}? It will remain recoverable.`)) return;
    setError('');
    const parameter = kind === 'projects' ? 'projectId' : 'teamId';
    const response = await fetch(`${endpoint}?${parameter}=${record.id}`, {
      method: 'DELETE',
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) {
      setError('The resource could not be archived.');
      return;
    }
    await load(organizationId);
    setNotice('Archived.');
  }

  async function connectRepository(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repositoryProjectId) return;
    setError('');
    setNotice('');
    const response = await fetch(`/api/projects/${repositoryProjectId}/repository`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        providerType: 'GITHUB',
        owner: repositoryOwner,
        name: repositoryName,
        defaultBranch: repositoryBranch,
        accessToken: repositoryToken || undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      repository?: { status?: string };
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? 'The GitHub repository could not be connected.');
      return;
    }
    setRepositoryToken('');
    setNotice(
      payload.repository?.status === 'CONNECTED'
        ? 'GitHub repository connected. The token was encrypted and is no longer displayed.'
        : 'Repository metadata saved, but a token is still required before agents can push.',
    );
  }

  return (
    <section className="live-panel" aria-label={`${kind} management`}>
      <div className="live-panel-toolbar">
        <label htmlFor={`${kind}-organization`}>Organization</label>
        <select
          id={`${kind}-organization`}
          value={organizationId}
          onChange={(event) => selectOrganization(event.target.value)}
          disabled={!organizations.length}
        >
          {!organizations.length && (
            <option value="">No organizations — create one in Settings</option>
          )}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      <form className="resource-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor={`${kind}-name`}>{kind === 'projects' ? 'Project' : 'Team'} name</label>
        <input
          id={`${kind}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
        />
        <label htmlFor={`${kind}-description`}>Description</label>
        <textarea
          id={`${kind}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2_000}
          rows={3}
        />
        <div className="action-row">
          <button className="primary-button" type="submit" disabled={!organizationId}>
            {editingId ? 'Save changes' : `Create ${kind === 'projects' ? 'project' : 'team'}`}
          </button>
          {editingId && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingId('');
                setName('');
                setDescription('');
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      {kind === 'projects' && (
        <form className="resource-form" onSubmit={(event) => void connectRepository(event)}>
          <h2>GitHub repository</h2>
          <p className="field-help">
            Connect the remote repository the PC worker will clone, edit on a dedicated branch, and
            push. Bunker Studio never merges automatically.
          </p>
          <label htmlFor="repository-project">Project</label>
          <select
            id="repository-project"
            value={repositoryProjectId}
            onChange={(event) => setRepositoryProjectId(event.target.value)}
            disabled={!records.length}
          >
            {!records.length && <option value="">Create a project first</option>}
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {record.name}
              </option>
            ))}
          </select>
          <FieldLabel
            htmlFor="repository-owner"
            help="The part of the repository address before the slash. In github.com/acme/studio that is acme."
          >
            GitHub owner or organization
          </FieldLabel>
          <input
            id="repository-owner"
            value={repositoryOwner}
            onChange={(event) => setRepositoryOwner(event.target.value)}
            required
          />
          <FieldLabel
            htmlFor="repository-name"
            help="The part after the slash. In github.com/acme/studio that is studio."
          >
            Repository name
          </FieldLabel>
          <input
            id="repository-name"
            value={repositoryName}
            onChange={(event) => setRepositoryName(event.target.value)}
            required
          />
          <FieldLabel
            htmlFor="repository-branch"
            help="The branch the work starts from and targets, usually main. Agents never write to it directly: they open a pull request against it."
          >
            Default branch
          </FieldLabel>
          <input
            id="repository-branch"
            value={repositoryBranch}
            onChange={(event) => setRepositoryBranch(event.target.value)}
            required
          />
          <FieldLabel
            htmlFor="repository-token"
            help="A key you create in your GitHub settings that grants access to this one repository. Give it permission to read and write contents and pull requests, and nothing more. It is encrypted before storage."
          >
            GitHub fine-grained access token
          </FieldLabel>
          <input
            id="repository-token"
            type="password"
            autoComplete="new-password"
            value={repositoryToken}
            onChange={(event) => setRepositoryToken(event.target.value)}
            required
          />
          <p className="field-help">
            Use a fine-grained token limited to this repository, with Contents read/write and Pull
            requests read/write. It is sent to the server over HTTPS and stored encrypted.
          </p>
          <button className="secondary-button" type="submit" disabled={!repositoryProjectId}>
            Connect GitHub repository
          </button>
        </form>
      )}
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
        {records.length === 0 && !error && (
          <span className="empty-state">Nothing recorded yet.</span>
        )}
        {records.map((record) => (
          <div className="live-record" key={record.id}>
            <span>
              <strong>{record.name}</strong>
              <small>{record.slug ?? record.description ?? 'No description'}</small>
            </span>
            <button className="secondary-button" type="button" onClick={() => startEdit(record)}>
              Edit
            </button>
            <button className="secondary-button" type="button" onClick={() => void archive(record)}>
              Archive
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
