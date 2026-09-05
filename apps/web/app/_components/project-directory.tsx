'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  GitHubRepositoryPicker,
  useGitHubConnections,
  type GitHubRepository,
} from './github-repository-picker';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  autonomyMode: string;
  createdAt: string;
  repository: {
    owner: string;
    name: string;
    defaultBranch: string;
    status: 'CONNECTED' | 'REQUIRES_AUTH';
  } | null;
  agents: { id: string; name: string; title: string; roleKey: string }[];
  tasks: { total: number; active: number; done: number; blocked: number };
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLocaleLowerCase();
}

/**
 * The projects home. A studio's projects are things you look at and open, so
 * this is a board of them; creating one is a separate, deliberate flow rather
 * than a form that occupies the page whether or not anyone needs it.
 */
export function ProjectDirectory() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [expandedId, setExpandedId] = useState('');
  const { connections } = useGitHubConnections(organizationId);
  const [connectionId, setConnectionId] = useState('');
  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [branch, setBranch] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextOrganizationId: string) {
    if (!nextOrganizationId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const response = await fetch('/api/projects', { headers: apiHeaders(nextOrganizationId) });
    setLoading(false);
    const payload = (await response.json().catch(() => ({}))) as {
      projects?: ProjectSummary[];
      error?: string;
    };
    if (!response.ok) {
      // The server names the cause; repeating a generic sentence over it only
      // hides what needs fixing.
      setError(payload.error ?? 'The projects of this organization could not be loaded.');
      return;
    }
    setError('');
    setProjects(payload.projects ?? []);
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organizations');
        const next =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(next);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = next.some((item) => item.id === saved) ? saved! : (next[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected);
      })
      .catch(() => {
        setLoading(false);
        setError('Create or select an organization to see its projects.');
      });
  }, []);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    setExpandedId('');
    setNotice('');
    void load(value);
  }

  async function attachRepository(project: ProjectSummary) {
    if (!repository || attaching) return;
    setError('');
    setNotice('');
    setAttaching(true);
    const response = await fetch(`/api/projects/${project.id}/repository`, {
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
    setAttaching(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? 'The repository could not be connected.');
      return;
    }
    setRepository(null);
    setBranch('');
    setNotice(`${project.name} now works on ${repository.fullName}.`);
    await load(organizationId);
  }

  async function archive(project: ProjectSummary) {
    if (!window.confirm(`Archive ${project.name}? It will remain recoverable.`)) return;
    const response = await fetch(
      `/api/organizations/${organizationId}/projects?projectId=${project.id}`,
      { method: 'DELETE', headers: apiHeaders(organizationId) },
    );
    if (!response.ok) {
      setError('The project could not be archived.');
      return;
    }
    setNotice(`${project.name} was archived.`);
    await load(organizationId);
  }

  return (
    <section className="live-panel" aria-label="Projects">
      <div className="live-panel-toolbar">
        <label htmlFor="projects-organization">Organization</label>
        <select
          id="projects-organization"
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
        {organizationId && (
          <Link className="primary-button" href="/projects/new">
            New project
          </Link>
        )}
      </div>
      {!organizations.length && !loading && (
        <div className="actionable-empty-state">
          <strong>You need an organization before you can create a project.</strong>
          <span>Projects, agents, budgets and repositories all belong to one.</span>
          <Link className="primary-button" href="/onboarding">
            Create an organization
          </Link>
        </div>
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
      {loading && <span className="empty-state">Loading projects…</span>}
      {!loading && organizationId && projects.length === 0 && !error && (
        <div className="actionable-empty-state">
          <strong>No projects in this organization yet.</strong>
          <span>
            A project binds a GitHub repository, the agents working on it, and the budget it spends.
          </span>
          <Link className="primary-button" href="/projects/new">
            Create the first project
          </Link>
        </div>
      )}
      <div className="project-grid">
        {projects.map((project) => {
          const expanded = expandedId === project.id;
          return (
            <article className="project-card" key={project.id}>
              <header className="project-card-head">
                <h2>{project.name}</h2>
                <span className={`project-badge project-badge-${project.status.toLowerCase()}`}>
                  {statusLabel(project.status)}
                </span>
              </header>
              <p className="project-card-description">
                {project.description || 'No description yet.'}
              </p>
              <p className="project-card-repository">
                {project.repository ? (
                  <>
                    <span
                      className={`project-dot ${
                        project.repository.status === 'CONNECTED'
                          ? 'project-dot-ready'
                          : 'project-dot-pending'
                      }`}
                      aria-hidden="true"
                    />
                    {project.repository.owner}/{project.repository.name}
                    <small> · {project.repository.defaultBranch}</small>
                    {project.repository.status !== 'CONNECTED' && <small> · token required</small>}
                  </>
                ) : (
                  <>
                    <span className="project-dot project-dot-missing" aria-hidden="true" />
                    No repository connected
                  </>
                )}
              </p>
              <dl className="project-card-metrics">
                <div>
                  <dt>Agents</dt>
                  <dd>{project.agents.length}</dd>
                </div>
                <div>
                  <dt>In flight</dt>
                  <dd>{project.tasks.active}</dd>
                </div>
                <div>
                  <dt>Done</dt>
                  <dd>{project.tasks.done}</dd>
                </div>
                <div>
                  <dt>Blocked</dt>
                  <dd>{project.tasks.blocked}</dd>
                </div>
              </dl>
              {expanded && (
                <div className="project-card-detail">
                  <h3>Agents allocated</h3>
                  {project.agents.length === 0 ? (
                    <p className="field-help">
                      No agent is assigned to this project yet. Assign one from the team builder, or
                      give it a task.
                    </p>
                  ) : (
                    <ul className="project-agent-list">
                      {project.agents.map((agent) => (
                        <li key={agent.id}>
                          <strong>{agent.name}</strong>
                          <small>
                            {agent.title} · {agent.roleKey}
                          </small>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!project.repository && (
                    <>
                      <h3>Repository</h3>
                      {connections.length === 0 ? (
                        <p className="field-help">
                          Connect a GitHub account in Settings and this project can pick a
                          repository from a list. <Link href="/settings#github">Open Settings</Link>
                        </p>
                      ) : (
                        <div className="resource-form">
                          <GitHubRepositoryPicker
                            organizationId={organizationId}
                            connections={connections}
                            idPrefix={`project-${project.id}`}
                            connectionId={connectionId}
                            onConnectionChange={setConnectionId}
                            repository={repository}
                            onRepositoryChange={setRepository}
                            branch={branch}
                            onBranchChange={setBranch}
                            onError={setError}
                          />
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={!repository || attaching}
                            onClick={() => void attachRepository(project)}
                          >
                            {attaching ? 'Connecting…' : 'Connect this repository'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <h3>Delivery</h3>
                  <p className="field-help">
                    {project.tasks.total} task{project.tasks.total === 1 ? '' : 's'} recorded ·
                    autonomy {statusLabel(project.autonomyMode)} · created{' '}
                    {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                  <div className="action-row">
                    <Link className="secondary-button" href="/tasks">
                      Open tasks
                    </Link>
                    <Link className="secondary-button" href="/teams">
                      Manage team
                    </Link>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void archive(project)}
                    >
                      Archive project
                    </button>
                  </div>
                </div>
              )}
              <div className="action-row">
                <button
                  className="secondary-button"
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => {
                    setExpandedId(expanded ? '' : project.id);
                    setRepository(null);
                    setBranch('');
                  }}
                >
                  {expanded ? 'Hide details' : 'Details'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
