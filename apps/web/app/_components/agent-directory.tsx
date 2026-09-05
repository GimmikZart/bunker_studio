'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';
import { AgentChatDrawer } from './agent-chat-drawer';
import { AgentInfoDialog } from './agent-info-dialog';
import {
  AgentAvatar,
  providerLabel,
  REASONING_LABELS,
  type Agent,
  type Organization,
  type Provider,
} from './agent-shared';

type Task = { id: string; assignedAgentId?: string; state: string; title: string };

/**
 * States in which the agent is the one holding the work: a run is queued, in
 * flight, or being verified on its behalf. Waiting on an approval or a budget
 * is the studio's problem, not the agent's, so it stays available to talk to.
 */
const BUSY_TASK_STATES = new Set(['QUEUED', 'RUNNING', 'VERIFYING']);

/**
 * The studio's people, one card each. The card carries what you need to tell
 * two agents apart — who it is, what it does, and which AI is behind it — and
 * the two things you actually do with an agent: talk to it, or look at how it
 * is set up.
 */
export function AgentDirectory() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectNames, setProjectNames] = useState(new Map<string, string>());
  const [teamNames, setTeamNames] = useState(new Map<string, string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatAgentId, setChatAgentId] = useState('');
  const [infoAgentId, setInfoAgentId] = useState('');

  const load = useCallback(async (id: string) => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const headers = apiHeaders(id);
    // The cards are what the page is for, so they appear as soon as the agents
    // do. Everything else here only decorates them — whether a card says "busy",
    // and the project and team names a detail dialog resolves — and waiting for
    // all of it before drawing anything left the page empty for as long as the
    // slowest of five requests.
    const agentsResponse = await fetch('/api/agents', { headers });
    setLoading(false);
    if (!agentsResponse.ok) {
      const payload = (await agentsResponse.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? 'We could not read this organization’s agents.');
      return;
    }
    setError('');
    setAgents(((await agentsResponse.json()) as { agents?: Agent[] }).agents ?? []);

    const read = async <T,>(path: string, take: (payload: unknown) => T, fallback: T) => {
      const response = await fetch(path, { headers }).catch(() => null);
      if (!response?.ok) return fallback;
      return take(await response.json().catch(() => ({})));
    };
    // A failure here leaves the list empty and the cards read "available", which
    // is also what a studio with no tasks at all looks like — never the reverse,
    // which would invite a message to an agent that is mid-run.
    setTasks(
      await read('/api/tasks', (payload) => (payload as { tasks?: Task[] }).tasks ?? [], []),
    );
    setProviders(
      await read(
        '/api/settings',
        (payload) =>
          ((payload as { providers?: Provider[] }).providers ?? []).filter(
            (provider) => provider.status === 'READY',
          ),
        [],
      ),
    );
    setProjectNames(
      await read(
        `/api/organizations/${id}/projects`,
        (payload) =>
          new Map(
            ((payload as { projects?: { id: string; name: string }[] }).projects ?? []).map(
              (project) => [project.id, project.name] as const,
            ),
          ),
        new Map<string, string>(),
      ),
    );
    setTeamNames(
      await read(
        `/api/organizations/${id}/teams`,
        (payload) =>
          new Map(
            ((payload as { teams?: { id: string; name: string }[] }).teams ?? []).map(
              (team) => [team.id, team.name] as const,
            ),
          ),
        new Map<string, string>(),
      ),
    );
  }, []);

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
      .catch(() => {
        setLoading(false);
        setError('You need an organization before you can manage agents.');
      });
  }, [load]);

  function selectOrganization(id: string) {
    setOrganizationId(id);
    window.localStorage.setItem('bunker-organization-id', id);
    setChatAgentId('');
    setInfoAgentId('');
    void load(id);
  }

  function busyTask(agentId: string): Task | undefined {
    return tasks.find(
      (task) => task.assignedAgentId === agentId && BUSY_TASK_STATES.has(task.state),
    );
  }

  const chatAgent = agents.find((agent) => agent.id === chatAgentId);
  const infoAgent = agents.find((agent) => agent.id === infoAgentId);

  return (
    <section aria-label="Agents" className="live-panel">
      <div className="live-panel-toolbar">
        <label htmlFor="agents-organization">Organization</label>
        <select
          disabled={!organizations.length}
          id="agents-organization"
          onChange={(event) => selectOrganization(event.target.value)}
          value={organizationId}
        >
          {!organizations.length && <option value="">Create an organization first</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <Link className="primary-button" href="/agents/new">
          Create new agent
        </Link>
      </div>

      {!organizations.length && !loading && (
        <div className="actionable-empty-state">
          <strong>You need an organization before you can create an agent.</strong>
          <span>Organizations keep identities, permissions, and history isolated.</span>
          <Link className="primary-button" href="/onboarding">
            Create an organization
          </Link>
        </div>
      )}

      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}

      {/* Only the first read is worth announcing. Saying it again while the
          cards are on screen made the list jump on every refresh. */}
      {loading && agents.length === 0 && <p className="live-summary">Loading agents…</p>}

      {!loading && organizationId && agents.length === 0 && !error && (
        <div className="actionable-empty-state">
          <strong>No agents in this organization yet.</strong>
          <span>An agent keeps its own name, role and memory whichever AI you put behind it.</span>
          <Link className="primary-button" href="/agents/new">
            Create the first agent
          </Link>
        </div>
      )}

      <div className="agent-grid">
        {agents.map((agent) => {
          const busy = busyTask(agent.id);
          return (
            <article className="agent-card" key={agent.id}>
              <AgentAvatar agent={agent} />
              <h2>{agent.name}</h2>
              <p className="agent-card-role">{agent.title}</p>
              <p className="agent-card-stack">
                <span>{providerLabel(agent.providerType)}</span>
                <span aria-hidden="true">|</span>
                <span>{agent.providerModelId}</span>
                <span aria-hidden="true">|</span>
                <span>{REASONING_LABELS[agent.reasoningEffort]}</span>
              </p>
              <div className="agent-card-actions">
                <button
                  className="secondary-button"
                  onClick={() => setInfoAgentId(agent.id)}
                  type="button"
                >
                  Info
                </button>
                <button
                  className="secondary-button agent-talk-button"
                  disabled={Boolean(busy)}
                  onClick={() => setChatAgentId(agent.id)}
                  title={busy ? `Working on “${busy.title}”` : undefined}
                  type="button"
                >
                  {busy ? 'Busy' : 'Talk to them'}
                  <span
                    aria-hidden="true"
                    className={busy ? 'agent-status-dot busy' : 'agent-status-dot free'}
                  />
                  <span className="visually-hidden">
                    {busy ? `Busy with ${busy.title}` : 'Available'}
                  </span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {chatAgent && (
        <AgentChatDrawer
          agent={chatAgent}
          onClose={() => setChatAgentId('')}
          organizationId={organizationId}
        />
      )}
      {infoAgent && (
        <AgentInfoDialog
          agent={infoAgent}
          names={{
            projects: projectNames,
            teams: teamNames,
            agents: new Map(agents.map((item) => [item.id, item.name])),
          }}
          onClose={() => setInfoAgentId('')}
          onSaved={() => void load(organizationId)}
          organizationId={organizationId}
          providers={providers}
        />
      )}
    </section>
  );
}
