'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Agent = { id: string; name: string; roleKey: string; status: string };
type DesignPreview = { id: string; title: string; html: string };
type Design = {
  id: string;
  version: number;
  status: string;
  rationale?: string;
  previews?: DesignPreview[];
};

export function DesignPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [versions, setVersions] = useState<Design[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [designerAgentId, setDesignerAgentId] = useState('');
  const [brief, setBrief] = useState('');
  const [constraints, setConstraints] = useState('');
  const [variantCount, setVariantCount] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load(id: string) {
    if (!id) return;
    const response = await fetch('/api/designs', { headers: apiHeaders(id) });
    if (!response.ok) {
      setError('We could not load design proposals. Try again.');
      return;
    }
    setVersions(((await response.json()) as { versions?: Design[] }).versions ?? []);
    const agentsResponse = await fetch('/api/agents', { headers: apiHeaders(id) });
    if (agentsResponse.ok) {
      const available = ((await agentsResponse.json()) as { agents?: Agent[] }).agents ?? [];
      setAgents(available.filter((agent) => agent.status === 'ACTIVE'));
    }
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
      .catch(() => setError('Create an organization before proposing a design.'));
  }, []);
  async function submit() {
    if (!brief.trim() || !organizationId || !designerAgentId) {
      setError('Choose a Designer agent and describe the interface or flow that needs approval.');
      return;
    }
    setError('');
    const response = await fetch('/api/designs', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        designerAgentId,
        brief,
        constraints: constraints
          .split('\n')
          .map((constraint) => constraint.trim())
          .filter(Boolean),
        variantCount,
      }),
    });
    if (!response.ok) {
      setError('The design proposal could not be submitted.');
      return;
    }
    setBrief('');
    setConstraints('');
    setNotice(
      'Safe static design proposal(s) created. An owner can now approve one for frontend work.',
    );
    await load(organizationId);
  }
  async function resolve(version: Design, decision: 'APPROVED' | 'REJECTED' | 'CHANGES') {
    const response = await fetch(`/api/designs/${version.id}/resolve`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!response.ok) {
      setError('Only an owner can resolve a submitted design.');
      return;
    }
    setNotice(
      decision === 'APPROVED'
        ? 'Design approved. It is now available for frontend tasks.'
        : 'Design resolution saved.',
    );
    await load(organizationId);
  }
  return (
    <section className="live-panel" aria-label="Design proposals">
      <div className="live-panel-toolbar">
        <label htmlFor="design-organization">Organization</label>
        <select
          id="design-organization"
          value={organizationId}
          onChange={(event) => {
            setOrganizationId(event.target.value);
            window.localStorage.setItem('bunker-organization-id', event.target.value);
            void load(event.target.value);
          }}
        >
          {organizations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {!organizationId && (
        <div className="actionable-empty-state">
          <strong>Create an organization before proposing a design.</strong>
          <Link className="primary-button" href="/onboarding">
            Create an organization
          </Link>
        </div>
      )}
      <div className="resource-form">
        <label htmlFor="design-agent">Designer agent</label>
        <select
          id="design-agent"
          value={designerAgentId}
          onChange={(event) => setDesignerAgentId(event.target.value)}
        >
          <option value="">Choose an active agent</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.roleKey})
            </option>
          ))}
        </select>
        {agents.length === 0 && organizationId && (
          <p className="field-help">
            Create and activate a Designer agent before submitting a request.
          </p>
        )}
        <label htmlFor="design-brief">Design brief</label>
        <textarea
          id="design-brief"
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          rows={5}
          maxLength={10_000}
          placeholder="User flow, required states, and constraints."
        />
        <label htmlFor="design-constraints">Constraints (one per line)</label>
        <textarea
          id="design-constraints"
          value={constraints}
          onChange={(event) => setConstraints(event.target.value)}
          rows={3}
          maxLength={10_000}
          placeholder="Accessibility: keyboard navigation\nBrand: use the existing design tokens"
        />
        <label htmlFor="design-variants">Variants</label>
        <select
          id="design-variants"
          value={variantCount}
          onChange={(event) => setVariantCount(Number(event.target.value))}
        >
          <option value={1}>1 proposal</option>
          <option value={2}>2 proposals</option>
          <option value={3}>3 proposals</option>
        </select>
        <p className="field-help">
          Each proposal includes a bounded, sandboxed static HTML preview. No script or remote
          content runs in the preview. Approving one is the owner-only gate for frontend tasks.
        </p>
        <button
          className="primary-button"
          type="button"
          onClick={() => void submit()}
          disabled={!organizationId || !designerAgentId}
        >
          Submit design for approval
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
        {versions.length === 0 && organizationId && (
          <span className="empty-state">
            No design proposal yet. Submit one above before opening frontend work.
          </span>
        )}
        {versions.map((version) => (
          <div className="live-record" key={version.id}>
            <span>
              <strong>Design v{version.version}</strong>
              <small>{version.status}</small>
            </span>
            {version.rationale && <p>{version.rationale}</p>}
            {version.previews?.map((preview) => (
              <figure key={preview.id}>
                <figcaption>{preview.title}</figcaption>
                <iframe
                  title={`${version.id}-${preview.title}`}
                  sandbox=""
                  srcDoc={preview.html}
                  style={{
                    border: '1px solid #d7dce5',
                    borderRadius: 8,
                    height: 280,
                    width: '100%',
                  }}
                />
              </figure>
            ))}
            {version.status === 'SUBMITTED' && (
              <span className="approval-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void resolve(version, 'CHANGES')}
                >
                  Request changes
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void resolve(version, 'APPROVED')}
                >
                  Approve
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
