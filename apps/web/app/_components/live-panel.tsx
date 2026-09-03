'use client';

import { useEffect, useState } from 'react';

type Organization = { id: string; name: string };
type Resource =
  'agents' | 'meetings' | 'approvals' | 'costs' | 'projects' | 'teams' | 'activity' | 'tasks';

export function apiHeaders(organizationId?: string): HeadersInit {
  return {
    ...(organizationId ? { 'x-bunker-organization-id': organizationId } : {}),
    ...(process.env.NODE_ENV !== 'production' ? { 'x-bunker-user-id': 'local-owner' } : {}),
  };
}

export function LivePanel({
  resource,
  title,
  description,
}: {
  resource: Resource;
  title: string;
  description: string;
}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [records, setRecords] = useState<unknown[]>([]);
  const [summary, setSummary] = useState<string>('Loading…');
  const [error, setError] = useState('');

  async function load(nextOrganizationId = organizationId) {
    if (!nextOrganizationId) return;
    setSummary('Loading…');
    setError('');
    const organizationResource = resource === 'projects' || resource === 'teams';
    const endpoint = organizationResource
      ? `/api/organizations/${nextOrganizationId}/${resource}`
      : `/api/${resource}`;
    const response = await fetch(endpoint, { headers: apiHeaders(nextOrganizationId) });
    if (!response.ok) {
      setError('Could not load this organization view.');
      setSummary('Unavailable');
      return;
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const values = (payload[resource] ?? payload.entries ?? []) as unknown[];
    setRecords(values);
    if (resource === 'costs') {
      const monthly = Number(payload.monthlyForecast ?? 0);
      setSummary(`Forecast $${monthly.toFixed(2)} · ${values.length} ledger entries`);
    } else {
      setSummary(`${values.length} ${resource} in this organization`);
    }
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
      .catch(() => setError('Create or select an organization to load live data.'));
    // The initial fetch intentionally runs once; subsequent changes use the select handler.
  }, [resource]);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    void load(value);
  }

  async function resolveApproval(id: string, status: 'APPROVED' | 'REJECTED') {
    const response = await fetch(`/api/approvals?approvalId=${id}`, {
      method: 'PATCH',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok) void load();
  }

  return (
    <section className="live-panel" aria-label={`${title} live view`}>
      <div className="live-panel-toolbar">
        <label htmlFor={`${resource}-organization`}>Organization</label>
        <select
          id={`${resource}-organization`}
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
      <div className="getting-started live-panel-card">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
          <p className="live-summary" aria-live="polite">
            {summary}
          </p>
          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="live-records">
          {records.length === 0 && !error && (
            <span className="empty-state">Nothing recorded yet.</span>
          )}
          {records.slice(0, 8).map((record, index) => {
            const item = record as Record<string, unknown>;
            const id = String(item.id ?? index);
            const label = String(
              item.name ?? item.title ?? item.provider ?? item.content ?? `Record ${index + 1}`,
            );
            const state = String(item.status ?? item.roleKey ?? item.meetingType ?? '');
            return (
              <div className="live-record" key={id}>
                <span>
                  <strong>{label}</strong>
                  {state && <small>{state}</small>}
                </span>
                {resource === 'approvals' && item.status === 'PENDING' && (
                  <span className="approval-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void resolveApproval(id, 'REJECTED')}
                    >
                      Reject
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void resolveApproval(id, 'APPROVED')}
                    >
                      Approve
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
