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

type NotificationPreferences = Record<
  'APPROVAL' | 'SECURITY' | 'BUDGET' | 'QUOTA' | 'WORKFLOW',
  boolean
>;

function formatHeartbeat(timestamp: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : 'Not reported';
}

export function SettingsPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextOrganizationId: string) {
    if (!nextOrganizationId) return;
    setError('');
    setNotice('');
    const headers = apiHeaders(nextOrganizationId);
    const [response, preferencesResponse] = await Promise.all([
      fetch('/api/settings', { headers }),
      fetch('/api/notifications/preferences', { headers }),
    ]);
    if (!response.ok || !preferencesResponse.ok) {
      setSettings(null);
      setPreferences(null);
      setError('Could not load settings for this organization.');
      return;
    }
    setSettings((await response.json()) as SettingsPayload);
    setPreferences(
      ((await preferencesResponse.json()) as { preferences?: NotificationPreferences })
        .preferences ?? null,
    );
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

  async function updatePreference(category: keyof NotificationPreferences, enabled: boolean) {
    if (!organizationId || !preferences) return;
    setError('');
    setNotice('');
    const next = { ...preferences, [category]: enabled };
    const response = await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      setError('Notification preferences could not be saved.');
      return;
    }
    setPreferences(next);
    setNotice('Notification preferences saved.');
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
          {preferences && (
            <div className="getting-started live-panel-card">
              <div>
                <h2>Notification preferences</h2>
                <p>Choose which categories can notify this user in the selected organization.</p>
                <div className="preference-list">
                  {(Object.keys(preferences) as (keyof NotificationPreferences)[]).map(
                    (category) => (
                      <label key={category}>
                        <input
                          type="checkbox"
                          checked={preferences[category]}
                          onChange={(event) =>
                            void updatePreference(category, event.target.checked)
                          }
                        />
                        {category}
                      </label>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {notice && (
        <p className="live-summary" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
