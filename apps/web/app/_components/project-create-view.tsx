'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  GitHubRepositoryPicker,
  useGitHubConnections,
  type GitHubRepository,
} from './github-repository-picker';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };

/**
 * Creating a project on its own page. The repository is chosen from what the
 * organization's connected GitHub account can already see, so owner, repository
 * and branch are read from GitHub instead of being retyped every time.
 */
export function ProjectCreateView() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const { connections } = useGitHubConnections(organizationId);
  const [connectionId, setConnectionId] = useState('');
  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [branch, setBranch] = useState('');
  const [attachRepository, setAttachRepository] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organizations');
        const next =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(next);
        const saved = window.localStorage.getItem('bunker-organization-id');
        setOrganizationId(next.some((item) => item.id === saved) ? saved! : (next[0]?.id ?? ''));
      })
      .catch(() => setError('Create or select an organization before creating a project.'));
  }, []);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    setConnectionId('');
    setRepository(null);
    setBranch('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || saving) return;
    setError('');
    const wantsRepository = attachRepository && connections.length > 0;
    if (wantsRepository && !repository) {
      setError('Choose the repository this project works on, or create it without one for now.');
      return;
    }
    setSaving(true);
    const projectResponse = await fetch(`/api/organizations/${organizationId}/projects`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!projectResponse.ok) {
      setSaving(false);
      const payload = (await projectResponse.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? 'The project could not be created.');
      return;
    }
    const project = ((await projectResponse.json()) as { project: { id: string } }).project;
    if (!wantsRepository || !repository) {
      setSaving(false);
      router.push('/projects');
      return;
    }
    // The project exists from here on, so a repository that cannot be attached
    // is reported against it instead of looking like nothing happened.
    const repositoryResponse = await fetch(`/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        providerType: 'GITHUB',
        owner: repository.owner,
        name: repository.name,
        defaultBranch: branch || repository.defaultBranch,
        githubConnectionId: connectionId,
      }),
    });
    setSaving(false);
    if (!repositoryResponse.ok) {
      const payload = (await repositoryResponse.json().catch(() => ({}))) as { error?: string };
      setError(
        `${name} was created, but its repository could not be attached. ${
          payload.error ?? 'GitHub refused the request.'
        } You can attach it from the project card.`,
      );
      return;
    }
    router.push('/projects');
  }

  return (
    <section className="live-panel" aria-label="Create a project">
      <div className="live-panel-toolbar">
        <label htmlFor="new-project-organization">Organization</label>
        <select
          id="new-project-organization"
          value={organizationId}
          onChange={(event) => selectOrganization(event.target.value)}
          disabled={!organizations.length}
        >
          {!organizations.length && <option value="">No organizations yet</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <Link className="secondary-button" href="/projects">
          Back to projects
        </Link>
      </div>
      {!organizations.length && (
        <div className="actionable-empty-state">
          <strong>You need an organization before you can create a project.</strong>
          <Link className="primary-button" href="/onboarding">
            Create an organization
          </Link>
        </div>
      )}
      <form className="resource-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="new-project-name">Project name</label>
        <input
          id="new-project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          disabled={!organizationId}
        />
        <label htmlFor="new-project-description">What this project delivers</label>
        <textarea
          id="new-project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2_000}
          rows={3}
          disabled={!organizationId}
        />
        <h2>Repository</h2>
        {connections.length === 0 ? (
          <div className="actionable-empty-state">
            <strong>This organization has no GitHub account connected.</strong>
            <span>
              Connect it once in Settings and every project afterwards picks a repository from a
              list. You can also create the project now and attach a repository later.
            </span>
            <Link className="secondary-button" href="/settings#github">
              Connect GitHub in Settings
            </Link>
          </div>
        ) : (
          <>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={attachRepository}
                onChange={(event) => setAttachRepository(event.target.checked)}
              />
              <span>Work on a GitHub repository from a connected account</span>
            </label>
            {attachRepository && (
              <GitHubRepositoryPicker
                organizationId={organizationId}
                connections={connections}
                idPrefix="new-project"
                connectionId={connectionId}
                onConnectionChange={setConnectionId}
                repository={repository}
                onRepositoryChange={setRepository}
                branch={branch}
                onBranchChange={setBranch}
                onError={setError}
              />
            )}
          </>
        )}
        {error && (
          <p className="live-error" role="alert">
            {error}
          </p>
        )}
        <div className="action-row">
          <button
            className="primary-button"
            type="submit"
            disabled={!organizationId || saving || !name.trim()}
          >
            {saving ? 'Creating…' : 'Create project'}
          </button>
          <Link className="secondary-button" href="/projects">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
