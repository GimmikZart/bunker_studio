'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';

export default function OnboardingPage() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Creating organization…');
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (process.env.NODE_ENV !== 'production') headers['x-bunker-user-id'] = 'local-owner';
    const response = await fetch('/api/organizations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      const payload = (await response.json()) as { organization?: { id: string } };
      if (payload.organization?.id)
        window.localStorage.setItem('bunker-organization-id', payload.organization.id);
      setCreated(true);
      setMessage('Organization created. Your studio is ready.');
    } else setMessage('We could not create the organization. Check the name and try again.');
  }

  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Welcome to Bunker Studio</p>
      <h1>Set up your organization.</h1>
      <p className="hero-copy">Start with a durable home for your teams, projects, and agents.</p>
      <form className="onboarding-form" onSubmit={submit}>
        <label htmlFor="organization-name">Organization name</label>
        <input
          id="organization-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          placeholder="e.g. Northstar Labs"
        />
        <button className="primary-button" type="submit" disabled={created}>
          Create organization
        </button>
        <p aria-live="polite">{message}</p>
      </form>
      {created && (
        <section className="next-steps" aria-label="Next steps">
          <h2>Choose the next step</h2>
          <p>A project gives work a home; an agent template gives it an accountable owner.</p>
          <div className="action-row">
            <Link className="primary-button" href="/projects">
              Create your first project
            </Link>
            <Link className="secondary-button" href="/agents">
              Create an agent from a template
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
