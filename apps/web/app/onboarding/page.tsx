'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

export default function OnboardingPage() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

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
    setMessage(
      response.ok
        ? 'Organization created. Your studio is ready.\n'
        : 'Could not create the organization.',
    );
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
        <button className="primary-button" type="submit">
          Create organization
        </button>
        <p aria-live="polite">{message}</p>
      </form>
    </main>
  );
}
