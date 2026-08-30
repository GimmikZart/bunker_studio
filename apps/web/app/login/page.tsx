'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setMessage(
      response.ok
        ? 'Signed in. Open your studio.'
        : (((await response.json()) as { error?: string }).error ?? 'Unable to sign in.'),
    );
  }
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Bunker Studio / Secure access</p>
      <h1>Return to your studio.</h1>
      <p className="hero-copy">Your organization state lives in Supabase, not in this browser.</p>
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
          Sign in
        </button>
        <p aria-live="polite">{message}</p>
        <a href="/signup">Create an account</a>
      </form>
    </main>
  );
}
