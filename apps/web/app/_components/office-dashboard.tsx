'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Agent = {
  id: string;
  name: string;
  title: string;
  roleKey: string;
  providerBindingId: string;
};
const areas = [
  { label: 'Lead', role: 'lead', tone: 'violet' },
  { label: 'Development', role: 'frontend', tone: 'blue' },
  { label: 'Design', role: 'designer', tone: 'amber' },
  { label: 'Review / QA', role: 'reviewer', tone: 'green' },
];

export function OfficeDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [organizationName, setOrganizationName] = useState('Bunker Studio');
  const [message, setMessage] = useState('Loading office…');

  useEffect(() => {
    void (async () => {
      const orgResponse = await fetch('/api/organizations', { headers: apiHeaders() });
      if (!orgResponse.ok) {
        setMessage('Create an organization to populate the office.');
        return;
      }
      const organizations =
        ((await orgResponse.json()) as { organizations?: { id: string; name: string }[] })
          .organizations ?? [];
      const organization =
        organizations.find(
          (item) => item.id === window.localStorage.getItem('bunker-organization-id'),
        ) ?? organizations[0];
      if (!organization) {
        setMessage('Create an organization to populate the office.');
        return;
      }
      window.localStorage.setItem('bunker-organization-id', organization.id);
      setOrganizationName(organization.name);
      const response = await fetch('/api/agents', { headers: apiHeaders(organization.id) });
      if (!response.ok) {
        setMessage('Office data is unavailable.');
        return;
      }
      setAgents(((await response.json()) as { agents?: Agent[] }).agents ?? []);
      setMessage('Presence is derived from deterministic task state.');
    })();
  }, []);

  return (
    <section className="office-grid" aria-label="Office areas">
      {areas.map((area) => {
        const members = agents.filter((agent) => agent.roleKey === area.role);
        return (
          <article className={`office-area ${area.tone}`} key={area.label}>
            <div className="area-heading">
              <span className="area-icon" aria-hidden="true" />
              {area.label}
            </div>
            <p>
              {members.length
                ? `${members.length} agent${members.length === 1 ? '' : 's'} assigned`
                : 'Ready for an assignment'}
            </p>
            {members.length ? (
              members.map((agent) => (
                <a className="office-agent" href={`/agents?agentId=${agent.id}`} key={agent.id}>
                  <strong>{agent.name}</strong>
                  <span>{agent.title}</span>
                </a>
              ))
            ) : (
              <div className="empty-state">{message}</div>
            )}
          </article>
        );
      })}
      <article className="meeting-area">
        <div className="area-heading">
          <span className="area-icon" aria-hidden="true" />
          Meeting room
        </div>
        <p>{organizationName} · bounded decisions, persisted minutes</p>
        <a className="secondary-button" href="/meetings">
          Open meetings
        </a>
      </article>
    </section>
  );
}
