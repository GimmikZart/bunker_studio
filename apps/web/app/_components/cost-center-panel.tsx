'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type CostEntry = {
  id: string;
  amount: number;
  occurredAt: string;
  provider: string;
  model: string;
  projectId?: string;
  taskId?: string;
  agentId?: string;
};
type BudgetPolicy = {
  id: string;
  periodType: string;
  softLimit: number;
  hardLimit: number;
  currency: string;
  actionOnSoft: string;
  actionOnHard: string;
  enabled: boolean;
};
type Provider = { id: string; displayName: string; status: string; models: string[] };

const money = (value: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);

function sum(entries: CostEntry[]) {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

function grouped(entries: CostEntry[], key: (entry: CostEntry) => string) {
  return Object.entries(
    entries.reduce<Record<string, number>>((result, entry) => {
      const label = key(entry);
      result[label] = (result[label] ?? 0) + entry.amount;
      return result;
    }, {}),
  ).sort(([, left], [, right]) => right - left);
}

export function CostCenterPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [forecast, setForecast] = useState(0);
  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(id = organizationId) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const headers = apiHeaders(id);
      const [costsResponse, policiesResponse, settingsResponse] = await Promise.all([
        fetch('/api/costs', { headers }),
        fetch('/api/budgets/policies', { headers }),
        fetch('/api/settings', { headers }),
      ]);
      if (!costsResponse.ok || !policiesResponse.ok || !settingsResponse.ok)
        throw new Error('load');
      const costs = (await costsResponse.json()) as {
        entries?: CostEntry[];
        monthlyForecast?: number;
      };
      const budget = (await policiesResponse.json()) as { policies?: BudgetPolicy[] };
      const settings = (await settingsResponse.json()) as { providers?: Provider[] };
      setEntries(costs.entries ?? []);
      setForecast(costs.monthlyForecast ?? 0);
      setPolicies(budget.policies ?? []);
      setProviders(settings.providers ?? []);
    } catch {
      setError('Could not load the cost center for this organization.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organizations');
        const values =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(values);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = values.some((item) => item.id === saved) ? saved! : (values[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected);
      })
      .catch(() => setError('Create or select an organization to view costs.'));
  }, []);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    void load(value);
  }

  const metrics = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1_000;
    const month = now.toISOString().slice(0, 7);
    return {
      today: sum(entries.filter((entry) => entry.occurredAt.slice(0, 10) === today)),
      week: sum(entries.filter((entry) => Date.parse(entry.occurredAt) >= weekStart)),
      month: sum(entries.filter((entry) => entry.occurredAt.slice(0, 7) === month)),
    };
  }, [entries]);
  const hardPolicies = policies.filter((policy) => policy.enabled && policy.hardLimit > 0);

  return (
    <section className="live-panel" aria-label="Cost center">
      <div className="live-panel-toolbar">
        <label htmlFor="cost-organization">Organization</label>
        <select
          id="cost-organization"
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
        <button
          className="secondary-button"
          type="button"
          disabled={!organizationId || loading}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="cost-metric-grid" aria-live="polite">
        {[
          ['Today', metrics.today],
          ['Current week', metrics.week],
          ['Current month', metrics.month],
          ['Month forecast', forecast],
        ].map(([label, value]) => (
          <article className="cost-metric" key={String(label)}>
            <span>{label}</span>
            <strong>{money(Number(value))}</strong>
          </article>
        ))}
      </div>
      <div className="cost-center-grid">
        <article className="live-panel-card cost-card">
          <div>
            <h2>Budget guardrails</h2>
            <p>Hard caps are enforced before a paid chat, queue transition, and worker claim.</p>
          </div>
          <div className="live-records">
            {hardPolicies.length === 0 && (
              <span className="empty-state">No hard cap configured.</span>
            )}
            {hardPolicies.map((policy) => (
              <div className="live-record" key={policy.id}>
                <span>
                  <strong>{policy.periodType}</strong>
                  <small>
                    Soft {money(policy.softLimit, policy.currency)} · hard{' '}
                    {money(policy.hardLimit, policy.currency)}
                  </small>
                </span>
                <small>{policy.actionOnHard}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="live-panel-card cost-card">
          <div>
            <h2>Provider quota status</h2>
            <p>
              Provider readiness is shown here; quota pauses are resumed by the deterministic
              scheduler.
            </p>
          </div>
          <div className="live-records">
            {providers.length === 0 && (
              <span className="empty-state">No provider connections yet.</span>
            )}
            {providers.map((provider) => (
              <div className="live-record" key={provider.id}>
                <span>
                  <strong>{provider.displayName}</strong>
                  <small>{provider.models.join(', ') || 'No models discovered'}</small>
                </span>
                <small>{provider.status}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
      <div className="cost-center-grid">
        <article className="live-panel-card cost-card">
          <div>
            <h2>Top cost drivers</h2>
            <p>Grouped from the immutable, tenant-scoped cost ledger.</p>
          </div>
          <div className="live-records">
            {grouped(entries, (entry) => `${entry.provider} / ${entry.model}`)
              .slice(0, 6)
              .map(([label, amount]) => (
                <div className="live-record" key={label}>
                  <strong>{label}</strong>
                  <span>{money(amount)}</span>
                </div>
              ))}
            {!entries.length && <span className="empty-state">No ledger entries yet.</span>}
          </div>
        </article>
        <article className="live-panel-card cost-card">
          <div>
            <h2>Work attribution</h2>
            <p>Project, agent and task identifiers remain available for audit.</p>
          </div>
          <div className="live-records">
            {grouped(
              entries,
              (entry) => entry.taskId ?? entry.projectId ?? entry.agentId ?? 'Unassigned',
            )
              .slice(0, 6)
              .map(([label, amount]) => (
                <div className="live-record" key={label}>
                  <strong>{label}</strong>
                  <span>{money(amount)}</span>
                </div>
              ))}
            {!entries.length && <span className="empty-state">No attributed work yet.</span>}
          </div>
        </article>
      </div>
    </section>
  );
}
