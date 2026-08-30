'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type SettingsPayload = {
  providers: {
    id: string;
    displayName: string;
    providerType: string;
    status: string;
    capabilities: string[];
    models: string[];
  }[];
  workers: {
    id: string;
    name: string;
    status: string;
    capabilities: string[];
    activeJobs: number;
    maxConcurrent: number;
    lastHeartbeatAt: number;
  }[];
  runtime: {
    mode: string;
    providerType: string;
    endpointConfigured: boolean;
    apiKeyConfigured: boolean;
    model: string | null;
  };
};

function formatHeartbeat(timestamp: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : 'Not reported';
}

export function SettingsPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState('');

  async function load(nextOrganizationId: string) {
    if (!nextOrganizationId) return;
    setError('');
    const response = await fetch('/api/settings', { headers: apiHeaders(nextOrganizationId) });
    if (!response.ok) {
      setSettings(null);
      setError('Could not load settings for this organization.');
      return;
    }
    setSettings((await response.json()) as SettingsPayload);
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
        window.localStorage.setItem('bunker-organization-id', selected);
        await load(selected);
      })
      .catch(() => setError('Create or select an organization to load settings.'));
  }, []);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    void load(value);
  }

  return (
    <section className="live-panel" aria-label="Settings live view">
      <div className="live-panel-toolbar">
        <label htmlFor="settings-organization">Organization</label>
        <select
          id="settings-organization"
          value={organizationId}
          onChange={(event) => selectOrganization(event.target.value)}
          disabled={!organizations.length}
        >
          {!organizations.length && <option value="">No organizations</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {settings && (
        <div className="settings-grid">
          <div className="getting-started live-panel-card">
            <div>
              <h2>Runtime</h2>
              <p>
                {settings.runtime.mode} · {settings.runtime.providerType}
              </p>
              <p className="live-summary">
                Endpoint {settings.runtime.endpointConfigured ? 'configured' : 'missing'} · API key{' '}
                {settings.runtime.apiKeyConfigured ? 'configured' : 'missing'}
              </p>
              {settings.runtime.model && <small>Model: {settings.runtime.model}</small>}
            </div>
          </div>
          <div className="getting-started live-panel-card">
            <div>
              <h2>Providers</h2>
              <div className="live-records">
                {settings.providers.length === 0 && (
                  <span className="empty-state">No provider connections.</span>
                )}
                {settings.providers.map((provider) => (
                  <div className="live-record" key={provider.id}>
                    <span>
                      <strong>{provider.displayName}</strong>
                      <small>
                        {provider.providerType} · {provider.status}
                      </small>
                    </span>
                    <small>
                      {provider.models.length ? provider.models.join(', ') : 'No catalog models'}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="getting-started live-panel-card">
            <div>
              <h2>Workers</h2>
              <div className="live-records">
                {settings.workers.length === 0 && (
                  <span className="empty-state">No registered workers.</span>
                )}
                {settings.workers.map((worker) => (
                  <div className="live-record" key={worker.id}>
                    <span>
                      <strong>{worker.name}</strong>
                      <small>
                        {worker.status} · {worker.activeJobs}/{worker.maxConcurrent} active jobs
                      </small>
                    </span>
                    <small>
                      {worker.capabilities.join(', ') || 'No capabilities'} ·{' '}
                      {formatHeartbeat(worker.lastHeartbeatAt)}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
