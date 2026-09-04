'use client';

import { useEffect, useState } from 'react';
import { FieldLabel } from './help-tip';
import { apiHeaders } from './live-panel';

export type GitHubConnection = {
  id: string;
  accountLogin: string;
  accountType: 'USER' | 'ORGANIZATION';
  createdAt?: string;
};

export type GitHubRepository = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  canPush: boolean;
};

/** The GitHub accounts connected to an organization, loaded once per selection. */
export function useGitHubConnections(organizationId: string) {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) {
      setConnections([]);
      return;
    }
    let current = true;
    setLoading(true);
    void fetch(`/api/organizations/${organizationId}/github`, {
      headers: apiHeaders(organizationId),
    })
      .then(async (response) => {
        if (!current) return;
        setConnections(
          response.ok
            ? (((await response.json()) as { connections?: GitHubConnection[] }).connections ?? [])
            : [],
        );
      })
      .catch(() => {
        if (current) setConnections([]);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [organizationId]);

  return { connections, loading };
}

/**
 * Choosing a repository from what a connected account already exposes. Shared by
 * project creation and by attaching a repository to a project that has none, so
 * neither asks anyone to retype an owner, a repository name and a branch.
 */
export function GitHubRepositoryPicker({
  organizationId,
  connections,
  idPrefix,
  connectionId,
  onConnectionChange,
  repository,
  onRepositoryChange,
  branch,
  onBranchChange,
  onError,
}: {
  organizationId: string;
  connections: GitHubConnection[];
  idPrefix: string;
  connectionId: string;
  onConnectionChange: (connectionId: string) => void;
  repository: GitHubRepository | null;
  onRepositoryChange: (repository: GitHubRepository | null) => void;
  branch: string;
  onBranchChange: (branch: string) => void;
  onError: (message: string) => void;
}) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  // The first account is preselected so the common case — one account — needs no
  // choice at all.
  useEffect(() => {
    if (!connectionId && connections[0]) onConnectionChange(connections[0].id);
    // Only the arrival of the accounts should preselect one; reacting to the
    // selection itself would fight the user's own choice.
  }, [connections, connectionId, onConnectionChange]);

  useEffect(() => {
    if (!organizationId || !connectionId) {
      setRepositories([]);
      return;
    }
    let current = true;
    setLoading(true);
    void fetch(
      `/api/organizations/${organizationId}/github/repositories?connectionId=${connectionId}`,
      { headers: apiHeaders(organizationId) },
    )
      .then(async (response) => {
        if (!current) return;
        const payload = (await response.json().catch(() => ({}))) as {
          repositories?: GitHubRepository[];
          error?: string;
        };
        if (!response.ok) {
          onError(payload.error ?? 'The repositories of this GitHub account could not be read.');
          setRepositories([]);
          return;
        }
        setRepositories(payload.repositories ?? []);
      })
      .catch(() => {
        if (current) onError('GitHub could not be reached.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
    // The repository list is re-read when the account changes, and not when the
    // error handler identity does.
  }, [organizationId, connectionId, onError]);

  const visible = repositories.filter((candidate) =>
    filter.trim()
      ? candidate.fullName.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())
      : true,
  );

  return (
    <>
      {connections.length > 1 && (
        <>
          <label htmlFor={`${idPrefix}-account`}>GitHub account</label>
          <select
            id={`${idPrefix}-account`}
            value={connectionId}
            onChange={(event) => {
              onRepositoryChange(null);
              onConnectionChange(event.target.value);
            }}
          >
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.accountLogin}
                {connection.accountType === 'ORGANIZATION' ? ' (organization)' : ''}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor={`${idPrefix}-filter`}>Find a repository</label>
      <input
        id={`${idPrefix}-filter`}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Type to narrow the list"
        disabled={loading || !repositories.length}
      />
      <label htmlFor={`${idPrefix}-repository`}>Repository</label>
      <select
        id={`${idPrefix}-repository`}
        value={repository?.fullName ?? ''}
        onChange={(event) => {
          const next = repositories.find((item) => item.fullName === event.target.value) ?? null;
          onRepositoryChange(next);
          onBranchChange(next?.defaultBranch ?? '');
        }}
        disabled={loading || !repositories.length}
      >
        <option value="">
          {loading
            ? 'Reading repositories from GitHub…'
            : repositories.length
              ? 'Choose a repository'
              : 'This account exposes no repository to the token'}
        </option>
        {visible.map((candidate) => (
          <option key={candidate.fullName} value={candidate.fullName}>
            {candidate.fullName}
            {candidate.private ? ' · private' : ''}
            {candidate.canPush ? '' : ' · read-only'}
          </option>
        ))}
      </select>
      {repository && !repository.canPush && (
        <p className="live-error" role="status">
          The connected token can read {repository.fullName} but cannot push task branches. Widen
          the token permissions in GitHub, or pick another repository.
        </p>
      )}
      <FieldLabel
        htmlFor={`${idPrefix}-branch`}
        help="The branch work starts from and targets. Agents never write to it directly: they open a pull request against it."
      >
        Default branch
      </FieldLabel>
      <input
        id={`${idPrefix}-branch`}
        value={branch}
        onChange={(event) => onBranchChange(event.target.value)}
        disabled={!repository}
        placeholder={repository?.defaultBranch ?? 'main'}
      />
      <p className="field-help">
        Read from GitHub for the repository you picked. Change it only if the work targets a
        different branch.
      </p>
    </>
  );
}
