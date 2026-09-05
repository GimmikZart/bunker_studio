'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
      <RepositoryCombobox
        idPrefix={idPrefix}
        loading={loading}
        repositories={repositories}
        repository={repository}
        onRepositoryChange={(next) => {
          onRepositoryChange(next);
          onBranchChange(next?.defaultBranch ?? '');
        }}
      />
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

/**
 * One field instead of two. The filter used to live in its own input beside a
 * plain select, so narrowing the list and choosing from it were separate
 * gestures on a list that can hold hundreds of repositories. Here the typing
 * and the choosing happen in the same control, and the reset button gives back
 * the full list in one click.
 */
function RepositoryCombobox({
  idPrefix,
  loading,
  repositories,
  repository,
  onRepositoryChange,
}: {
  idPrefix: string;
  loading: boolean;
  repositories: GitHubRepository[];
  repository: GitHubRepository | null;
  onRepositoryChange: (repository: GitHubRepository | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = `${useId()}-repositories`;

  // The chosen repository is what the field shows; the query only takes over
  // while the list is being narrowed.
  const text = open ? query : (repository?.fullName ?? '');
  const visible = useMemo(() => {
    const needle = open ? query.trim().toLocaleLowerCase() : '';
    if (!needle) return repositories;
    return repositories.filter((candidate) =>
      candidate.fullName.toLocaleLowerCase().includes(needle),
    );
  }, [open, query, repositories]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function choose(candidate: GitHubRepository | undefined) {
    if (!candidate) return;
    onRepositoryChange(candidate);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlighted(0);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) =>
        visible.length ? (current + step + visible.length) % visible.length : 0,
      );
      return;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(visible[highlighted]);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setQuery('');
      setOpen(false);
    }
  }

  const placeholder = loading
    ? 'Reading repositories from GitHub…'
    : repositories.length
      ? 'Search owner/repository'
      : 'This account exposes no repository to the token';

  return (
    <>
      <label htmlFor={`${idPrefix}-repository`}>Repository</label>
      <div className="combobox" ref={containerRef}>
        <div className="combobox-control">
          <input
            id={`${idPrefix}-repository`}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && visible[highlighted] ? `${listId}-${highlighted}` : undefined
            }
            autoComplete="off"
            ref={inputRef}
            value={text}
            placeholder={placeholder}
            disabled={loading || !repositories.length}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery('');
              setHighlighted(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <button
            className="combobox-reset"
            type="button"
            aria-label="Clear the chosen repository"
            disabled={!repository && !query}
            onClick={() => {
              onRepositoryChange(null);
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            Reset
          </button>
        </div>
        {open && (
          <ul className="combobox-list" id={listId} role="listbox">
            {visible.length === 0 && (
              <li className="combobox-empty" role="presentation">
                No repository matches “{query}”.
              </li>
            )}
            {visible.slice(0, 100).map((candidate, index) => (
              <li
                aria-selected={candidate.fullName === repository?.fullName}
                className={
                  index === highlighted ? 'combobox-option highlighted' : 'combobox-option'
                }
                id={`${listId}-${index}`}
                key={candidate.fullName}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(candidate)}
                role="option"
              >
                <strong>{candidate.fullName}</strong>
                <small>
                  {candidate.private ? 'private' : 'public'}
                  {candidate.canPush ? '' : ' · read-only'}
                  {candidate.description ? ` · ${candidate.description}` : ''}
                </small>
              </li>
            ))}
            {visible.length > 100 && (
              <li className="combobox-empty" role="presentation">
                {visible.length - 100} more — keep typing to narrow the list.
              </li>
            )}
          </ul>
        )}
      </div>
    </>
  );
}
