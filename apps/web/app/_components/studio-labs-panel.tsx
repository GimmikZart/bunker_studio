'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Project = { id: string; name: string; isStudioCore: boolean };
type Proposal = { id: string; title: string; rationale: string; writeScope: string[] };
type Snapshot = {
  completedTasks: number;
  reviewPassRate: number;
  totalCost: number;
  activityEvents: number;
  agentCount: number;
};

export function StudioLabsPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalId, setProposalId] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadProjects(nextOrganizationId: string) {
    const response = await fetch(`/api/organizations/${nextOrganizationId}/projects`, {
      headers: apiHeaders(nextOrganizationId),
    });
    if (!response.ok) throw new Error('projects');
    const nextProjects = ((await response.json()) as { projects?: Project[] }).projects ?? [];
    setProjects(nextProjects);
    setProjectId(
      nextProjects.find((project) => project.isStudioCore)?.id ?? nextProjects[0]?.id ?? '',
    );
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
        if (selected) await loadProjects(selected);
      })
      .catch(() => setError('Create an organization to use Studio Labs.'));
  }, []);

  async function call(action: 'INITIALIZE' | 'ANALYZE' | 'SELECT') {
    setError('');
    setMessage('');
    const body = action === 'SELECT' ? { action, projectId, proposalId } : { action };
    const response = await fetch('/api/studio-labs', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: string;
      project?: Project;
      snapshot?: Snapshot;
      proposals?: Proposal[];
      task?: { id: string };
      approval?: { id: string };
    };
    if (!response.ok) {
      setError(payload.error ?? 'Studio Labs action failed.');
      return;
    }
    if (payload.project) {
      setMessage('Protected Studio Core is ready.');
      await loadProjects(organizationId);
    }
    if (payload.snapshot) {
      setSnapshot(payload.snapshot);
      setProposals(payload.proposals ?? []);
      setProposalId(payload.proposals?.[0]?.id ?? '');
      setMessage('Analysis complete. Select a proposal to create gated work.');
    }
    if (payload.task && payload.approval)
      setMessage(
        `Task ${payload.task.id} created; Owner approval ${payload.approval.id} is required.`,
      );
  }

  return (
    <section className="live-panel" aria-label="Studio Labs">
      <div className="live-panel-toolbar">
        <label htmlFor="labs-organization">Organization</label>
        <select
          id="labs-organization"
          value={organizationId}
          onChange={(event) => {
            const next = event.target.value;
            setOrganizationId(next);
            window.localStorage.setItem('bunker-organization-id', next);
            void loadProjects(next).catch(() => setError('Could not load projects.'));
          }}
        >
          {!organizations.length && <option value="">No organizations</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      <div className="getting-started live-panel-card">
        <div>
          <p className="eyebrow">Protected self-improvement</p>
          <h2>Studio Labs</h2>
          <p>Analyze deterministic signals and prepare reviewed improvements for Studio Core.</p>
          {snapshot && (
            <p className="live-summary">
              {snapshot.completedTasks} completed tasks ·{' '}
              {(snapshot.reviewPassRate * 100).toFixed(0)}% review pass · $
              {snapshot.totalCost.toFixed(2)} cost · {snapshot.activityEvents} activity events
            </p>
          )}
          {message && (
            <p className="live-summary" aria-live="polite">
              {message}
            </p>
          )}
          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="live-records">
          <button
            className="secondary-button"
            type="button"
            disabled={!organizationId}
            onClick={() => void call('INITIALIZE')}
          >
            Initialize Studio Core
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!organizationId}
            onClick={() => void call('ANALYZE')}
          >
            Analyze metrics
          </button>
          {proposals.map((proposal) => (
            <label className="live-record" key={proposal.id}>
              <span>
                <strong>{proposal.title}</strong>
                <small>{proposal.rationale}</small>
              </span>
              <input
                type="radio"
                name="studio-lab-proposal"
                value={proposal.id}
                checked={proposalId === proposal.id}
                onChange={() => setProposalId(proposal.id)}
              />
            </label>
          ))}
          {proposals.length > 0 && (
            <label>
              Protected project
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                    {project.isStudioCore ? ' · protected' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {proposals.length > 0 && (
            <button
              className="primary-button"
              type="button"
              disabled={!projectId || !proposalId}
              onClick={() => void call('SELECT')}
            >
              Select and request approval
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
