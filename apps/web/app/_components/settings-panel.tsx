'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { apiHeaders } from './live-panel';
import { FieldLabel } from './help-tip';
import { OrganizationCreateForm } from './organization-create-form';
import { ProviderSummary } from './provider-summary';

type Organization = { id: string; name: string };
type SettingsPayload = {
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
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
    providerSelection: string;
    workerRequired: boolean;
  };
  secureProviderStorage?: boolean;
  persistence?: { mode: 'SUPABASE' | 'MEMORY'; host: string | null; local: boolean };
};

type ProviderType = 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE';

type GitHubConnection = {
  id: string;
  accountLogin: string;
  accountType: 'USER' | 'ORGANIZATION';
  createdAt: string;
};

type NotificationPreferences = Record<
  'APPROVAL' | 'SECURITY' | 'BUDGET' | 'QUOTA' | 'WORKFLOW',
  boolean
>;

type BudgetPolicy = {
  id: string;
  periodType: 'PER_RUN' | 'PER_TASK' | 'DAILY' | 'MONTHLY';
  softLimit: number;
  hardLimit: number;
  currency: string;
  actionOnSoft: 'ALLOW' | 'NOTIFY' | 'REQUIRE_APPROVAL';
  actionOnHard: 'BLOCK' | 'REQUIRE_APPROVAL';
  escalationThreshold: number;
  allowProviderFallback: boolean;
  enabled: boolean;
};

type ReportSchedule = {
  id: string;
  frequency: 'WEEKLY';
  dayOfWeek: number;
  hourUtc: number;
  minuteUtc: number;
  timezone: string;
  recipients: string[];
  enabled: boolean;
  nextRunAt: string;
};

const emptyPolicy = {
  periodType: 'MONTHLY' as BudgetPolicy['periodType'],
  softLimit: 0,
  hardLimit: 0,
  currency: 'USD',
  actionOnSoft: 'NOTIFY' as BudgetPolicy['actionOnSoft'],
  actionOnHard: 'BLOCK' as BudgetPolicy['actionOnHard'],
  escalationThreshold: 2,
  allowProviderFallback: false,
  enabled: true,
};

function formatHeartbeat(timestamp: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : 'Not reported';
}

function decodeVapidKey(value: string): ArrayBuffer {
  const normalized = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = window.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  binary.split('').forEach((character, index) => {
    bytes[index] = character.charCodeAt(0);
  });
  return bytes.buffer;
}

export function SettingsPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [budgetPolicies, setBudgetPolicies] = useState<BudgetPolicy[]>([]);
  const [policyForm, setPolicyForm] = useState(emptyPolicy);
  const [reportSchedule, setReportSchedule] = useState<ReportSchedule | null>(null);
  const [reportForm, setReportForm] = useState({
    dayOfWeek: 1,
    hourUtc: 9,
    minuteUtc: 0,
    timezone: 'UTC',
    recipients: '',
    enabled: true,
  });
  const [providerForm, setProviderForm] = useState({
    providerType: 'OPENAI' as ProviderType,
    displayName: 'OpenAI',
    apiKey: '',
    apiBaseUrl: '',
    manualModels: '',
  });
  const [savingProvider, setSavingProvider] = useState(false);
  const [githubConnections, setGithubConnections] = useState<GitHubConnection[]>([]);
  const [githubToken, setGithubToken] = useState('');
  const [savingGitHub, setSavingGitHub] = useState(false);
  const [workerScopes, setWorkerScopes] = useState('');
  const [workerRegistration, setWorkerRegistration] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextOrganizationId: string) {
    if (!nextOrganizationId) return;
    setError('');
    setNotice('');
    const headers = apiHeaders(nextOrganizationId);
    const [response, preferencesResponse, pushResponse, policiesResponse, reportResponse] =
      await Promise.all([
        fetch('/api/settings', { headers }),
        fetch('/api/notifications/preferences', { headers }),
        fetch('/api/notifications/subscribe', { headers }),
        fetch('/api/budgets/policies', { headers }),
        fetch('/api/budgets/report', { headers }),
      ]);
    if (
      !response.ok ||
      !preferencesResponse.ok ||
      !pushResponse.ok ||
      !policiesResponse.ok ||
      !reportResponse.ok
    ) {
      setSettings(null);
      setPreferences(null);
      setVapidPublicKey(null);
      setError('Could not load settings for this organization.');
      return;
    }
    setSettings((await response.json()) as SettingsPayload);
    setPreferences(
      ((await preferencesResponse.json()) as { preferences?: NotificationPreferences })
        .preferences ?? null,
    );
    setVapidPublicKey(
      ((await pushResponse.json()) as { publicKey?: string | null }).publicKey ?? null,
    );
    const policies =
      ((await policiesResponse.json()) as { policies?: BudgetPolicy[] }).policies ?? [];
    setBudgetPolicies(policies);
    setPolicyForm(policies[0] ? { ...policies[0] } : emptyPolicy);
    // A GitHub account is optional, so a studio without one still loads.
    const githubResponse = await fetch(`/api/organizations/${nextOrganizationId}/github`, {
      headers,
    });
    setGithubConnections(
      githubResponse.ok
        ? (((await githubResponse.json()) as { connections?: GitHubConnection[] }).connections ??
            [])
        : [],
    );
    const schedule =
      ((await reportResponse.json()) as { schedule?: ReportSchedule | null }).schedule ?? null;
    setReportSchedule(schedule);
    if (schedule)
      setReportForm({
        dayOfWeek: schedule.dayOfWeek,
        hourUtc: schedule.hourUtc,
        minuteUtc: schedule.minuteUtc,
        timezone: schedule.timezone,
        recipients: schedule.recipients.join(', '),
        enabled: schedule.enabled,
      });
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

  async function connectGitHub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || savingGitHub) return;
    setError('');
    setNotice('');
    setSavingGitHub(true);
    const response = await fetch(`/api/organizations/${organizationId}/github`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ accessToken: githubToken }),
    });
    setSavingGitHub(false);
    const payload = (await response.json().catch(() => ({}))) as {
      connection?: GitHubConnection;
      error?: string;
    };
    if (!response.ok || !payload.connection) {
      setError(payload.error ?? 'The GitHub account could not be connected.');
      return;
    }
    setGithubToken('');
    setGithubConnections((current) => [
      ...current.filter((connection) => connection.id !== payload.connection!.id),
      payload.connection!,
    ]);
    setNotice(
      `GitHub account ${payload.connection.accountLogin} connected. Its token was encrypted and is no longer displayed.`,
    );
  }

  async function disconnectGitHub(connection: GitHubConnection) {
    if (
      !window.confirm(
        `Disconnect ${connection.accountLogin}? Projects already connected keep working until their repository is reconnected.`,
      )
    )
      return;
    setError('');
    setNotice('');
    const response = await fetch(
      `/api/organizations/${organizationId}/github?connectionId=${connection.id}`,
      { method: 'DELETE', headers: apiHeaders(organizationId) },
    );
    if (!response.ok) {
      setError('The GitHub account could not be disconnected.');
      return;
    }
    setGithubConnections((current) => current.filter((item) => item.id !== connection.id));
    setNotice(`${connection.accountLogin} was disconnected.`);
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

  async function enablePushNotifications() {
    setError('');
    setNotice('');
    if (!vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications are not configured or supported in this browser.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Browser notification permission was not granted.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(vapidPublicKey),
        }));
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error('subscription');
      setNotice('Push notifications enabled for this browser.');
    } catch {
      setError('Push notifications could not be enabled.');
    }
  }

  async function saveBudgetPolicy() {
    if (!organizationId) return;
    setError('');
    setNotice('');
    const existing = budgetPolicies[0];
    const response = await fetch(
      existing ? `/api/budgets/policies/${existing.id}` : '/api/budgets/policies',
      {
        method: existing ? 'PATCH' : 'POST',
        headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
        body: JSON.stringify(policyForm),
      },
    );
    if (!response.ok) {
      setError('Budget policy could not be saved. Check that soft limit is below hard limit.');
      return;
    }
    const saved = ((await response.json()) as { policy: BudgetPolicy }).policy;
    setBudgetPolicies([saved]);
    setPolicyForm(saved);
    setNotice('Budget policy saved.');
  }

  async function saveReportSchedule() {
    if (!organizationId) return;
    setError('');
    setNotice('');
    const response = await fetch('/api/budgets/report', {
      method: 'PUT',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        frequency: 'WEEKLY',
        dayOfWeek: reportForm.dayOfWeek,
        hourUtc: reportForm.hourUtc,
        minuteUtc: reportForm.minuteUtc,
        timezone: reportForm.timezone,
        recipients: reportForm.recipients
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        enabled: reportForm.enabled,
      }),
    });
    if (!response.ok) {
      setError('Weekly report schedule could not be saved.');
      return;
    }
    const saved = ((await response.json()) as { schedule: ReportSchedule }).schedule;
    setReportSchedule(saved);
    setNotice('Weekly report schedule saved.');
  }

  async function connectProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !providerForm.apiKey.trim()) return;
    setError('');
    setNotice('');
    setSavingProvider(true);
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
        body: JSON.stringify({
          providerType: providerForm.providerType,
          displayName: providerForm.displayName,
          apiKey: providerForm.apiKey,
          apiBaseUrl: providerForm.apiBaseUrl || undefined,
          manualModels: providerForm.manualModels
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Provider setup failed.');
      setProviderForm((current) => ({ ...current, apiKey: '' }));
      await load(organizationId);
      setNotice('Provider connected. Its models are now available when creating an agent.');
    } catch (providerError) {
      setError(
        providerError instanceof Error
          ? providerError.message
          : 'The provider could not be connected.',
      );
    } finally {
      setSavingProvider(false);
    }
  }

  async function createWorkerRegistration() {
    if (!organizationId) return;
    setError('');
    setNotice('');
    const response = await fetch('/api/workers/registration-tokens', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        allowedScopes: workerScopes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        maxConcurrent: 1,
        expiresInMinutes: 60,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      token?: string;
      expiresAt?: string;
      error?: string;
    };
    if (!response.ok || !payload.token || !payload.expiresAt) {
      setError(payload.error ?? 'The worker registration token could not be created.');
      return;
    }
    setWorkerRegistration({ token: payload.token, expiresAt: payload.expiresAt });
    setNotice('One-time worker token created. Run the command on the PC before it expires.');
  }

  async function revokeWorker(workerId: string, workerName: string) {
    if (!organizationId) return;
    if (!window.confirm(`Revoke ${workerName}? Its credential will stop working immediately.`))
      return;
    setError('');
    setNotice('');
    const response = await fetch(`/api/workers/${workerId}`, {
      method: 'DELETE',
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) {
      setError('The worker could not be revoked.');
      return;
    }
    await load(organizationId);
    setNotice(
      `${workerName} was revoked. Active work will return to the queue when its lease expires.`,
    );
  }

  async function downloadOrganizationExport() {
    if (!organizationId || settings?.role !== 'OWNER') return;
    setError('');
    setNotice('');
    const response = await fetch(`/api/organizations/${organizationId}/export`, {
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) {
      setError('The organization export could not be prepared.');
      return;
    }
    const blob = await response.blob();
    const filename =
      response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] ??
      'bunker-studio-export.json';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Organization export downloaded. Provider credentials are excluded.');
  }

  async function importOrganizationExport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError('');
    setNotice('');
    if (file.size > 10 * 1024 * 1024) {
      setError('The export file must be 10 MB or smaller.');
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setError('This file is not a valid Bunker Studio JSON export.');
      return;
    }
    const response = await fetch('/api/organizations/import', {
      method: 'POST',
      headers: { ...apiHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => ({}))) as {
      organization?: { id: string; name: string };
      error?: string;
    };
    if (!response.ok || !result.organization) {
      setError(result.error ?? 'The organization export could not be imported.');
      return;
    }
    setOrganizations((current) => [...current, result.organization!]);
    setOrganizationId(result.organization.id);
    window.localStorage.setItem('bunker-organization-id', result.organization.id);
    await load(result.organization.id);
    setNotice(
      `${result.organization.name} was imported. Reconnect provider credentials before use.`,
    );
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
      {settings?.persistence && (
        <p className="storage-target">
          {settings.persistence.mode === 'SUPABASE'
            ? `Storing data in Supabase at ${settings.persistence.host ?? 'the configured project'}${settings.persistence.local ? ' (local Docker)' : ''}.`
            : 'Storing data in memory for this run only.'}
        </p>
      )}
      {!organizations.length && (
        <OrganizationCreateForm description="Providers, budgets, workers and members are all configured per organization, so create one before adding an API key." />
      )}
      {error && organizations.length > 0 && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {settings && (
        <div className="settings-grid">
          <div className="getting-started live-panel-card" id="providers">
            <div>
              <h2>Providers</h2>
              {settings.persistence?.mode === 'MEMORY' && (
                <p className="live-error" role="status">
                  This run is not connected to a database, so anything you save disappears when the
                  server stops. Set SUPABASE_URL and SUPABASE_ANON_KEY in the root .env — pointing
                  at the local Docker project or a cloud one — and restart.
                </p>
              )}
              <p>
                Connect one account per provider. The key is sent only to the server, encrypted, and
                never shown again. Reading the model catalog does not run a model or consume
                inference tokens.
              </p>
              {settings.secureProviderStorage === false && (
                <p className="live-error" role="status">
                  STUDIO_MASTER_KEY is not set, so a key cannot be encrypted before storage. Add a
                  32-byte base64url value to .env as STUDIO_MASTER_KEY and restart the server before
                  connecting a provider.
                </p>
              )}
              <form
                className="settings-form-grid"
                onSubmit={(event) => void connectProvider(event)}
              >
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="provider-type"
                    help={
                      <>
                        The company whose AI you want to use. Pick <strong>OpenAI</strong> or{' '}
                        <strong>Anthropic</strong> if you have an account with them. Pick{' '}
                        <strong>OpenAI-compatible</strong> for anything else that speaks the same
                        protocol, such as a model running on your own machine.
                      </>
                    }
                  >
                    Provider
                  </FieldLabel>
                  <select
                    id="provider-type"
                    value={providerForm.providerType}
                    onChange={(event) => {
                      const providerType = event.target.value as ProviderType;
                      setProviderForm({
                        ...providerForm,
                        providerType,
                        displayName:
                          providerType === 'OPENAI'
                            ? 'OpenAI'
                            : providerType === 'ANTHROPIC'
                              ? 'Anthropic'
                              : 'OpenAI-compatible provider',
                        apiBaseUrl: '',
                        manualModels: '',
                      });
                    }}
                  >
                    <option value="OPENAI">OpenAI</option>
                    <option value="ANTHROPIC">Anthropic</option>
                    <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
                  </select>
                </span>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="provider-display-name"
                    help="Only a label, so you can tell accounts apart in this list. Anything you recognise works."
                  >
                    Display name
                  </FieldLabel>
                  <input
                    id="provider-display-name"
                    value={providerForm.displayName}
                    onChange={(event) =>
                      setProviderForm({ ...providerForm, displayName: event.target.value })
                    }
                    required
                  />
                </span>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="provider-api-key"
                    help={
                      <>
                        The secret string from your provider account, usually starting with{' '}
                        <code>sk-</code>. You create it in the provider&apos;s own dashboard. It is
                        encrypted before it is stored and is never shown again, so keep your own
                        copy.
                      </>
                    }
                  >
                    API key
                  </FieldLabel>
                  <input
                    id="provider-api-key"
                    type="password"
                    autoComplete="new-password"
                    value={providerForm.apiKey}
                    onChange={(event) =>
                      setProviderForm({ ...providerForm, apiKey: event.target.value })
                    }
                    required
                  />
                </span>
                {providerForm.providerType === 'OPENAI_COMPATIBLE' && (
                  <>
                    <span className="settings-field">
                      <FieldLabel
                        htmlFor="provider-base-url"
                        help={
                          <>
                            The web address where that AI answers. For a model running on your own
                            computer it usually looks like <code>http://127.0.0.1:11434/v1</code>.
                            The tool you installed tells you this address.
                          </>
                        }
                      >
                        Address of the service
                      </FieldLabel>
                      <input
                        id="provider-base-url"
                        type="url"
                        placeholder="http://127.0.0.1:11434/v1"
                        value={providerForm.apiBaseUrl}
                        onChange={(event) =>
                          setProviderForm({ ...providerForm, apiBaseUrl: event.target.value })
                        }
                        required
                      />
                    </span>
                    <span className="settings-field">
                      <FieldLabel
                        htmlFor="provider-models"
                        help="OpenAI and Anthropic tell us which models exist. Other services cannot, so list the names yourself, separated by commas, exactly as that service spells them."
                      >
                        Model names
                      </FieldLabel>
                      <input
                        id="provider-models"
                        placeholder="model-a, model-b"
                        value={providerForm.manualModels}
                        onChange={(event) =>
                          setProviderForm({ ...providerForm, manualModels: event.target.value })
                        }
                        required
                      />
                    </span>
                  </>
                )}
                <button className="secondary-button" type="submit" disabled={savingProvider}>
                  {savingProvider ? 'Connecting…' : 'Connect provider'}
                </button>
              </form>
              <div className="live-records">
                {settings.providers.length === 0 && (
                  <div className="actionable-empty-state">
                    <strong>No provider connection is ready.</strong>
                    <span>
                      Add OpenAI now, or leave any provider you do not use unconfigured. A local
                      model can be added later without blocking the cloud providers.
                    </span>
                  </div>
                )}
                {settings.providers.map((provider) => (
                  <ProviderSummary key={provider.id} provider={provider} />
                ))}
              </div>
            </div>
          </div>
          <div className="getting-started live-panel-card" id="github">
            <div>
              <h2>GitHub</h2>
              <p>
                Connect the GitHub account this organization works through — once. Every project
                created afterwards picks its repository from what this account can already see,
                instead of asking you to retype owner, repository and branch.
              </p>
              <p className="field-help">
                An organization can hold more than one account, so repositories owned by different
                GitHub users or organizations are all reachable.
              </p>
              {settings.secureProviderStorage === false && (
                <p className="live-error" role="status">
                  STUDIO_MASTER_KEY is not set, so a token cannot be encrypted before storage. Add a
                  32-byte base64url value to .env as STUDIO_MASTER_KEY and restart the server before
                  connecting GitHub.
                </p>
              )}
              <form className="settings-form-grid" onSubmit={(event) => void connectGitHub(event)}>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="github-token"
                    help={
                      <>
                        <span>
                          A key that lets this app act on your repositories on your behalf. It is
                          created in your GitHub account settings, not on a repository page — which
                          is where most people look first.
                        </span>
                        <span>
                          On GitHub: profile picture, top right, then <strong>Settings</strong> →{' '}
                          <strong>Developer settings</strong> →{' '}
                          <strong>Personal access tokens</strong> →{' '}
                          <strong>Fine-grained tokens</strong> → <strong>Generate new token</strong>
                          .
                        </span>
                        <span>
                          Set <strong>Resource owner</strong> to the account or organisation that
                          owns the repositories, choose the repositories this studio may work on,
                          then under <strong>Repository permissions</strong> grant{' '}
                          <strong>Contents: Read and write</strong> and{' '}
                          <strong>Pull requests: Read and write</strong>. Nothing else is needed.
                        </span>
                        <span>
                          Only the repositories you select here appear when you create a project.
                          Copy the token when it is shown: GitHub does not show it again.
                        </span>
                      </>
                    }
                  >
                    GitHub fine-grained access token
                  </FieldLabel>
                  <input
                    id="github-token"
                    type="password"
                    autoComplete="new-password"
                    value={githubToken}
                    onChange={(event) => setGithubToken(event.target.value)}
                    placeholder="github_pat_…"
                    required
                  />
                </span>
                <p className="field-help">
                  Create it at{' '}
                  <a
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    github.com/settings/personal-access-tokens/new
                  </a>
                  . It is sent over HTTPS, stored encrypted, and never shown again.
                </p>
                <button
                  className="secondary-button"
                  type="submit"
                  disabled={savingGitHub || !githubToken.trim()}
                >
                  {savingGitHub ? 'Checking with GitHub…' : 'Connect GitHub account'}
                </button>
              </form>
              <div className="live-records">
                {githubConnections.length === 0 ? (
                  <span className="empty-state">No GitHub account connected yet.</span>
                ) : (
                  githubConnections.map((connection) => (
                    <div className="live-record" key={connection.id}>
                      <span>
                        <strong>{connection.accountLogin}</strong>
                        <small>
                          {connection.accountType === 'ORGANIZATION'
                            ? 'GitHub organization'
                            : 'GitHub user'}{' '}
                          · connected {new Date(connection.createdAt).toLocaleDateString()}
                        </small>
                      </span>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void disconnectGitHub(connection)}
                      >
                        Disconnect
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="getting-started live-panel-card">
            <div>
              <h2>Execution</h2>
              <p>{settings.runtime.mode}</p>
              <p className="live-summary">
                {settings.runtime.providerSelection}.{' '}
                {settings.runtime.workerRequired
                  ? 'Repository jobs run on an authenticated worker, such as your PC.'
                  : 'No worker is required.'}
              </p>
            </div>
          </div>
          <div className="getting-started live-panel-card">
            <div>
              <h2>Workers</h2>
              <p>
                A worker is the program that runs on your own computer and does the work that needs
                your code: reading it, changing it, running the tests. This app never opens a
                connection to your computer — the worker calls out to the app, so you do not need to
                open anything on your router.
              </p>
              <span className="settings-field">
                <FieldLabel
                  htmlFor="worker-scopes"
                  help={
                    <>
                      <span>
                        The folders of your project this computer is allowed to open and change.
                        Anything outside them stays untouched, even if an agent asks.
                      </span>
                      <span>
                        Write the folder names as they appear at the top level of your project,
                        separated by commas — for example <code>apps, packages, docs</code>. Not
                        sure? Start with the folder that holds the code you want worked on. You can
                        change this later.
                      </span>
                    </>
                  }
                >
                  Folders this computer may change
                </FieldLabel>
                <input
                  id="worker-scopes"
                  value={workerScopes}
                  onChange={(event) => setWorkerScopes(event.target.value)}
                  placeholder="apps, packages, docs"
                />
              </span>
              <p className="field-help">
                Separate folders with commas. Leaving this empty means the worker may not change any
                file, which is only useful for tasks that read code without editing it.
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void createWorkerRegistration()}
              >
                Create PC worker command
              </button>
              {workerRegistration && (
                <div className="actionable-empty-state">
                  <strong>Run these lines in PowerShell from the Bunker Studio folder</strong>
                  <code>{`$env:WORKER_CONTROL_PLANE_URL='${typeof window === 'undefined' ? '' : window.location.origin}'`}</code>
                  <code>{`$env:WORKER_REGISTRATION_TOKEN='${workerRegistration.token}'`}</code>
                  <code>{`$env:WORKER_CAPABILITIES='chat,repository,codex'`}</code>
                  <code>{`$env:WORKER_WORKSPACE_ROOT="$PWD\\.bunker\\workspaces"`}</code>
                  <code>pnpm --filter @bunker-studio/worker dev</code>
                  <small>
                    Token valid until {new Date(workerRegistration.expiresAt).toLocaleString()} and
                    shown only here. After the first start, the worker saves its own credential in
                    .bunker and no longer needs this token.
                  </small>
                </div>
              )}
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
                    {worker.status !== 'REVOKED' && (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void revokeWorker(worker.id, worker.name)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="getting-started live-panel-card">
            <div>
              <h2>Portability</h2>
              <p>
                Export preserves organization data, relationships, memories and conversation
                history, but never provider credentials. Import always creates a new organization
                and requires provider reconnection.
              </p>
              {settings.role === 'OWNER' ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void downloadOrganizationExport()}
                >
                  Download organization export
                </button>
              ) : (
                <small>Only the organization Owner can download an export.</small>
              )}
              <label htmlFor="organization-import">Import Bunker Studio export</label>
              <input
                id="organization-import"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void importOrganizationExport(event)}
              />
              <small>Maximum file size: 10 MB.</small>
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
                <div className="action-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void enablePushNotifications()}
                    disabled={!vapidPublicKey}
                  >
                    {vapidPublicKey ? 'Enable browser push' : 'Push not configured'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="getting-started live-panel-card">
            <div>
              <h2>Cost policy</h2>
              <p>Set hard and soft budget limits for the selected organization.</p>
              <div className="settings-form-grid">
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="budget-period"
                    help="How often the limit resets. Per run applies to a single AI call, per task to one task, and daily or monthly to everything in that window."
                  >
                    Period
                  </FieldLabel>
                  <select
                    id="budget-period"
                    value={policyForm.periodType}
                    onChange={(event) =>
                      setPolicyForm({
                        ...policyForm,
                        periodType: event.target.value as BudgetPolicy['periodType'],
                      })
                    }
                  >
                    <option value="PER_RUN">Per run</option>
                    <option value="PER_TASK">Per task</option>
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </span>
                <label>
                  Currency
                  <input
                    value={policyForm.currency}
                    maxLength={3}
                    onChange={(event) =>
                      setPolicyForm({ ...policyForm, currency: event.target.value.toUpperCase() })
                    }
                  />
                </label>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="budget-soft-limit"
                    help="A warning level. Crossing it does not stop the work; it triggers the soft action below so you find out early."
                  >
                    Soft limit
                  </FieldLabel>
                  <input
                    id="budget-soft-limit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={policyForm.softLimit}
                    onChange={(event) =>
                      setPolicyForm({ ...policyForm, softLimit: Number(event.target.value) })
                    }
                  />
                </span>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="budget-hard-limit"
                    help="The ceiling. Work that would cross it is stopped or sent to you for approval before any paid call is made, so it cannot be crossed by accident."
                  >
                    Hard limit
                  </FieldLabel>
                  <input
                    id="budget-hard-limit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={policyForm.hardLimit}
                    onChange={(event) =>
                      setPolicyForm({ ...policyForm, hardLimit: Number(event.target.value) })
                    }
                  />
                </span>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="budget-soft-action"
                    help="What happens at the warning level: carry on quietly, notify you, or wait for your approval."
                  >
                    Soft action
                  </FieldLabel>
                  <select
                    id="budget-soft-action"
                    value={policyForm.actionOnSoft}
                    onChange={(event) =>
                      setPolicyForm({
                        ...policyForm,
                        actionOnSoft: event.target.value as BudgetPolicy['actionOnSoft'],
                      })
                    }
                  >
                    <option value="ALLOW">Allow</option>
                    <option value="NOTIFY">Notify</option>
                    <option value="REQUIRE_APPROVAL">Require approval</option>
                  </select>
                </span>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="budget-hard-action"
                    help="What happens at the ceiling: block the work outright, or hold it until you approve it."
                  >
                    Hard action
                  </FieldLabel>
                  <select
                    id="budget-hard-action"
                    value={policyForm.actionOnHard}
                    onChange={(event) =>
                      setPolicyForm({
                        ...policyForm,
                        actionOnHard: event.target.value as BudgetPolicy['actionOnHard'],
                      })
                    }
                  >
                    <option value="BLOCK">Block</option>
                    <option value="REQUIRE_APPROVAL">Require approval</option>
                  </select>
                </span>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="budget-escalate"
                    help="How many failed attempts before the studio stops retrying and asks a human. Keeps a stuck task from burning budget in a loop."
                  >
                    Escalate after
                  </FieldLabel>
                  <input
                    id="budget-escalate"
                    type="number"
                    min="0"
                    max="100"
                    value={policyForm.escalationThreshold}
                    onChange={(event) =>
                      setPolicyForm({
                        ...policyForm,
                        escalationThreshold: Number(event.target.value),
                      })
                    }
                  />
                </span>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={policyForm.allowProviderFallback}
                    onChange={(event) =>
                      setPolicyForm({ ...policyForm, allowProviderFallback: event.target.checked })
                    }
                  />{' '}
                  Allow provider fallback
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={policyForm.enabled}
                    onChange={(event) =>
                      setPolicyForm({ ...policyForm, enabled: event.target.checked })
                    }
                  />{' '}
                  Policy enabled
                </label>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void saveBudgetPolicy()}
              >
                Save cost policy
              </button>
            </div>
          </div>
          <div className="getting-started live-panel-card">
            <div>
              <h2>Weekly cost report</h2>
              <p>
                {reportSchedule
                  ? `Next report: ${new Date(reportSchedule.nextRunAt).toLocaleString()}`
                  : 'No report schedule configured.'}
              </p>
              <div className="settings-form-grid">
                <label>
                  Day
                  <select
                    value={reportForm.dayOfWeek}
                    onChange={(event) =>
                      setReportForm({ ...reportForm, dayOfWeek: Number(event.target.value) })
                    }
                  >
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </label>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="report-hour"
                    help="The hour the weekly report is produced, in UTC. If you are in central Europe, subtract one hour in winter and two in summer to get your local time."
                  >
                    UTC hour
                  </FieldLabel>
                  <input
                    id="report-hour"
                    type="number"
                    min="0"
                    max="23"
                    value={reportForm.hourUtc}
                    onChange={(event) =>
                      setReportForm({ ...reportForm, hourUtc: Number(event.target.value) })
                    }
                  />
                </span>
                <label>
                  UTC minute
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={reportForm.minuteUtc}
                    onChange={(event) =>
                      setReportForm({ ...reportForm, minuteUtc: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Timezone
                  <input
                    value={reportForm.timezone}
                    onChange={(event) =>
                      setReportForm({ ...reportForm, timezone: event.target.value })
                    }
                  />
                </label>
                <span className="settings-field">
                  <FieldLabel
                    htmlFor="report-recipients"
                    help="Who receives the weekly cost report, as email addresses separated by commas."
                  >
                    Recipients
                  </FieldLabel>
                  <input
                    id="report-recipients"
                    placeholder="owner@example.com, finance@example.com"
                    value={reportForm.recipients}
                    onChange={(event) =>
                      setReportForm({ ...reportForm, recipients: event.target.value })
                    }
                  />
                </span>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={reportForm.enabled}
                    onChange={(event) =>
                      setReportForm({ ...reportForm, enabled: event.target.checked })
                    }
                  />{' '}
                  Report enabled
                </label>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void saveReportSchedule()}
              >
                Save weekly report
              </button>
            </div>
          </div>
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
