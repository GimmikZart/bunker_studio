'use client';

import { useState } from 'react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json()) as { error?: string; sessionCreated?: boolean };
    setMessage(
      response.ok
        ? body.sessionCreated
          ? 'Account created. Open your studio.'
          : 'Check your email to confirm your account.'
        : (body.error ?? 'Unable to create account.'),
    );
  }
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Bunker Studio / Create access</p>
      <h1>Create your studio access.</h1>
      <p className="hero-copy">
        Use a verified account so your organization state remains available across devices.
      </p>
      <form className="onboarding-form" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="primary-button" type="submit">
          Create account
        </button>
        <p aria-live="polite">{message}</p>
        <a href="/login">Already have access? Sign in.</a>
      </form>
    </main>
  );
}
