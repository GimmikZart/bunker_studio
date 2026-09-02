'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Project = { id: string; name: string };
type Agent = { id: string; name: string; title: string; status: string };
type Meeting = {
  id: string;
  title: string;
  meetingType: string;
  agenda: string[];
  agentIds: string[];
  maxRounds: number;
  status: string;
  cost: number;
  contributions: { agentId: string; round: number; content: string }[];
  minutes: {
    summary: string;
    decisions: { title: string; decision: string }[];
    actionItems: { title: string; ownerAgentId?: string }[];
  } | null;
};

export function MeetingRoomPanel() {
  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('ARCHITECTURE');
  const [agenda, setAgenda] = useState('');
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [maxRounds, setMaxRounds] = useState(2);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load(id: string) {
    if (!id) return;
    const headers = apiHeaders(id);
    const [p, a, m] = await Promise.all([
      fetch(`/api/organizations/${id}/projects`, { headers }),
      fetch('/api/agents', { headers }),
      fetch('/api/meetings', { headers }),
    ]);
    if (!p.ok || !a.ok || !m.ok) throw new Error();
    setProjects(((await p.json()) as { projects?: Project[] }).projects ?? []);
    setAgents(
      (((await a.json()) as { agents?: Agent[] }).agents ?? []).filter(
        (agent) => agent.status === 'ACTIVE',
      ),
    );
    setMeetings(((await m.json()) as { meetings?: Meeting[] }).meetings ?? []);
  }
  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const values =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(values);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const id = values.some((item) => item.id === saved) ? saved! : (values[0]?.id ?? '');
        setOrganizationId(id);
        await load(id);
      })
      .catch(() => setError('Create an organization before scheduling a meeting.'));
  }, []);
  async function create() {
    if (!organizationId || !projectId || !title.trim() || !agenda.trim() || !agentIds.length)
      return setError('Choose a project and participant, then add a title and agenda.');
    const response = await fetch('/api/meetings', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        title,
        meetingType,
        agenda: agenda
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        agentIds,
        maxRounds,
      }),
    });
    if (!response.ok) return setError('The meeting could not be scheduled.');
    setTitle('');
    setAgenda('');
    setNotice('Meeting scheduled. Run it when the agenda is ready.');
    await load(organizationId);
  }
  async function run(meetingId: string) {
    const response = await fetch(`/api/meetings/${meetingId}/run`, {
      method: 'POST',
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) return setError('The meeting could not run.');
    setNotice('Meeting completed; minutes, actions, and cost are recorded.');
    await load(organizationId);
  }
  return (
    <section className="live-panel" aria-label="Meeting room">
      <div className="live-panel-toolbar">
        <label htmlFor="meeting-org">Organization</label>
        <select
          id="meeting-org"
          value={organizationId}
          onChange={(event) => {
            setOrganizationId(event.target.value);
            window.localStorage.setItem('bunker-organization-id', event.target.value);
            void load(event.target.value);
          }}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      <div className="resource-form">
        <label htmlFor="meeting-project">Project</label>
        <select
          id="meeting-project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">Choose project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <label htmlFor="meeting-title">Meeting title</label>
        <input
          id="meeting-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="meeting-type">Meeting type</label>
        <select
          id="meeting-type"
          value={meetingType}
          onChange={(event) => setMeetingType(event.target.value)}
        >
          <option>ARCHITECTURE</option>
          <option>PLANNING</option>
          <option>REVIEW</option>
        </select>
        <label htmlFor="meeting-agenda">Agenda (one item per line)</label>
        <textarea
          id="meeting-agenda"
          value={agenda}
          onChange={(event) => setAgenda(event.target.value)}
          rows={3}
        />
        <fieldset>
          <legend>Participants</legend>
          {agents.map((agent) => (
            <label key={agent.id}>
              <input
                type="checkbox"
                checked={agentIds.includes(agent.id)}
                onChange={() =>
                  setAgentIds((current) =>
                    current.includes(agent.id)
                      ? current.filter((id) => id !== agent.id)
                      : [...current, agent.id],
                  )
                }
              />
              {agent.name} ({agent.title})
            </label>
          ))}
        </fieldset>
        <label htmlFor="meeting-rounds">Maximum rounds</label>
        <select
          id="meeting-rounds"
          value={maxRounds}
          onChange={(event) => setMaxRounds(Number(event.target.value))}
        >
          <option value={1}>1 round</option>
          <option value={2}>2 rounds</option>
          <option value={3}>3 rounds</option>
        </select>
        <button className="primary-button" type="button" onClick={() => void create()}>
          Schedule meeting
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
      <div className="live-records">
        {meetings.map((meeting) => (
          <article className="live-record" key={meeting.id}>
            <strong>{meeting.title}</strong>
            <small>
              {meeting.meetingType} · {meeting.status} · {meeting.cost.toFixed(2)} cost
            </small>
            <p>Agenda: {meeting.agenda.join(' · ')}</p>
            {meeting.status === 'DRAFT' && (
              <button className="primary-button" type="button" onClick={() => void run(meeting.id)}>
                Run meeting
              </button>
            )}
            {meeting.minutes && (
              <>
                <p>{meeting.minutes.summary}</p>
                <p>
                  Decisions:{' '}
                  {meeting.minutes.decisions.map((decision) => decision.title).join(', ')}
                </p>
                <p>
                  Actions: {meeting.minutes.actionItems.map((action) => action.title).join(', ')}
                </p>
              </>
            )}
            {meeting.contributions.map((contribution, index) => (
              <small key={`${contribution.agentId}-${index}`}>
                Round {contribution.round}: {contribution.content}
              </small>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
