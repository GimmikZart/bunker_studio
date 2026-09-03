'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiHeaders } from './live-panel';

export type CreatedOrganization = { id: string; name: string };

/**
 * Creates the first organization.
 *
 * Every panel in the studio is scoped to an organization, so without one the
 * whole app reads as empty. This form is therefore reachable from Settings and
 * from the Office landing page rather than living only in onboarding.
 */
export function OrganizationCreateForm({
  onCreated,
  heading = 'Create an organization',
  description = 'Everything in the studio — agents, projects, budgets and settings — belongs to an organization.',
}: {
  onCreated?: (organization: CreatedOrganization) => void;
  heading?: string;
  description?: string;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError('Give the organization a name.');
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { ...apiHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const payload = (await response.json()) as {
        organization?: CreatedOrganization;
        error?: string;
      };
      if (!response.ok || !payload.organization) {
        setError(
          payload.error ??
            'The organization could not be created. Check that you are signed in and try again.',
        );
        return;
      }
      window.localStorage.setItem('bunker-organization-id', payload.organization.id);
      setName('');
      // The panels read the selected organization on mount, so a reload is the
      // reliable way to bring the whole page into the new tenant.
      if (onCreated) onCreated(payload.organization);
      else window.location.reload();
    } catch {
      setError('The organization could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="organization-create" onSubmit={submit}>
      <h2>{heading}</h2>
      <p>{description}</p>
      <label htmlFor="new-organization-name">Organization name</label>
      <input
        id="new-organization-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        placeholder="e.g. Northstar Labs"
        required
      />
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Create organization'}
      </button>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
