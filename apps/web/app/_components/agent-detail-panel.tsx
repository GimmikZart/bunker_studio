'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Agent = {
  id: string;
  name: string;
  roleKey: string;
  title: string;
  personality: Record<string, unknown>;
  avatarAssetId: string | null;
  skills: string[];
  tools: string[];
  permissions: string[];
  providerBindingId: string;
};

type Assignment = {
  id: string;
  teamId: string | null;
  projectId: string | null;
  reportsToAgentId: string | null;
};

type AgentMetrics = {
  tasksCompleted: number;
  firstReviewPassRate: number;
  averageTaskCost: number;
  medianCycleTimeMs: number;
};

export function AgentDetailPanel() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [chatContent, setChatContent] = useState('');
  const [chatReply, setChatReply] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatSessionId, setChatSessionId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const queryAgentId = new URLSearchParams(window.location.search).get('agentId');
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (organizationResponse) => {
        if (!organizationResponse.ok) throw new Error('organization');
        const organizations =
          ((await organizationResponse.json()) as { organizations?: { id: string }[] })
            .organizations ?? [];
        const saved = window.localStorage.getItem('bunker-organization-id');
        const organizationId = organizations.some((item) => item.id === saved)
          ? saved
          : organizations[0]?.id;
        if (!organizationId) throw new Error('organization');
        setOrganizationId(organizationId);
        const response = await fetch('/api/agents', { headers: apiHeaders(organizationId) });
        if (!response.ok) throw new Error('agent');
        const agents = ((await response.json()) as { agents?: Agent[] }).agents ?? [];
        const selected = agents.find((item) => item.id === queryAgentId) ?? agents[0];
        if (!selected) return;
        setAgent(selected);
        const assignmentsResponse = await fetch(`/api/agents/${selected.id}/assignments`, {
          headers: apiHeaders(organizationId),
        });
        if (assignmentsResponse.ok)
          setAssignments(
            ((await assignmentsResponse.json()) as { assignments?: Assignment[] }).assignments ??
              [],
          );
        const metricsResponse = await fetch(`/api/agents/${selected.id}/metrics`, {
          headers: apiHeaders(organizationId),
        });
        if (metricsResponse.ok)
          setMetrics(
            ((await metricsResponse.json()) as { metrics?: AgentMetrics }).metrics ?? null,
          );
      })
      .catch(() => setError('Create an organization and agent to view the detail.'));
  }, []);

  async function sendChat() {
    if (!agent || !organizationId || !chatContent.trim()) return;
    setChatError('');
    const response = await fetch(`/api/agents/${agent.id}/chat`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ content: chatContent, sessionId: chatSessionId || undefined }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: { content?: string };
      sessionId?: string;
      error?: string;
    };
    if (!response.ok) {
      setChatError(
        payload.error ?? 'The chat could not be started. Check provider and budget settings.',
      );
      return;
    }
    setChatReply(payload.message?.content ?? 'No response was returned.');
    setChatSessionId(payload.sessionId ?? '');
    setChatContent('');
  }

  if (error)
    return (
      <p className="live-error" role="alert">
        {error}
      </p>
    );
  if (!agent)
    return (
      <section className="live-panel" aria-label="Agent detail">
        Loading agent detail…
      </section>
    );

  return (
    <section className="live-panel" aria-label="Agent detail">
      <div className="getting-started live-panel-card">
        <div>
          <p className="eyebrow">Agent detail</p>
          <h2>{agent.name}</h2>
          <p>
            {agent.title} · {agent.roleKey}
          </p>
          <p className="live-summary">Provider binding: {agent.providerBindingId}</p>
          <p className="live-summary">Avatar: {agent.avatarAssetId ?? 'Default'}</p>
          {metrics && (
            <p className="live-summary">
              Metrics: {metrics.tasksCompleted} done ·{' '}
              {(metrics.firstReviewPassRate * 100).toFixed(0)}% first-pass review · $
              {metrics.averageTaskCost.toFixed(2)} average cost
            </p>
          )}
        </div>
        <div className="live-records">
          <div className="live-record">
            <span>
              <strong>Skills</strong>
              <small>{agent.skills.join(', ') || 'None configured'}</small>
            </span>
          </div>
          <div className="live-record agent-chat-card">
            <span>
              <strong>Chat</strong>
              <small>
                Send a scoped message through the configured runtime. Budget and permission gates
                still apply.
              </small>
            </span>
            <textarea
              aria-label={`Chat with ${agent.name}`}
              value={chatContent}
              onChange={(event) => setChatContent(event.target.value)}
              placeholder={`Message ${agent.name}`}
              rows={3}
            />
            <button
              className="secondary-button"
              type="button"
              onClick={() => void sendChat()}
              disabled={!chatContent.trim()}
            >
              Send message
            </button>
            {chatReply && <small>{chatReply}</small>}
            {chatError && <small className="live-error">{chatError}</small>}
          </div>
          <div className="live-record">
            <span>
              <strong>Tools</strong>
              <small>{agent.tools.join(', ') || 'None configured'}</small>
            </span>
          </div>
          <div className="live-record">
            <span>
              <strong>Permissions</strong>
              <small>{agent.permissions.join(', ') || 'None configured'}</small>
            </span>
          </div>
          <div className="live-record">
            <span>
              <strong>Assignments</strong>
              <small>
                {assignments.length
                  ? assignments
                      .map((item) =>
                        [
                          item.teamId && `team:${item.teamId}`,
                          item.projectId && `project:${item.projectId}`,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      )
                      .join(' | ')
                  : 'No active assignment'}
              </small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
