import { NextResponse } from 'next/server';

/**
 * A database failure while reading or writing GitHub connections, said plainly.
 * The commonest one by far is a schema that has not been migrated yet, which
 * otherwise reaches the browser as an unexplained 500 and looks like a bug in
 * the feature rather than a pending `supabase db push`.
 */
export function githubStorageFailure(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown database failure.';
  if (/github_connections/.test(message) && /does not exist/i.test(message))
    return NextResponse.json(
      {
        error:
          'The database has no github_connections table yet. Apply the pending migrations with `supabase db push`, then reload this page.',
      },
      { status: 503 },
    );
  return NextResponse.json(
    { error: `The GitHub accounts could not be read. ${message}` },
    { status: 502 },
  );
}
