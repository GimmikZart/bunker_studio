'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AccountState = 'LOADING' | 'SIGNED_IN' | 'SIGNED_OUT' | 'NO_AUTH';

/**
 * Header affordance for the account.
 *
 * A hosted deployment requires a signed-in Supabase user for every API call, so
 * the sign-in route has to be reachable from the shell: without this, an
 * unauthenticated visitor sees empty panels everywhere and no way to fix it.
 * When Supabase Auth is not configured at all the studio runs on the local
 * fixture actor, and settings stays the right destination.
 */
export function AccountLink() {
  const [state, setState] = useState<AccountState>('LOADING');

  useEffect(() => {
    void fetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) return setState('SIGNED_OUT');
        const payload = (await response.json()) as { user?: unknown; authConfigured?: boolean };
        // Without cloud auth the studio runs on the local fixture actor, so
        // there is nothing to sign in to and settings stays the destination.
        setState(payload.authConfigured && payload.user ? 'SIGNED_IN' : 'NO_AUTH');
      })
      .catch(() => setState('NO_AUTH'));
  }, []);

  if (state === 'SIGNED_OUT')
    return (
      <Link className="secondary-button header-account" href="/login">
        Sign in
      </Link>
    );
  return (
    <Link className="avatar-button" href="/settings" aria-label="Open settings">
      GM
    </Link>
  );
}
