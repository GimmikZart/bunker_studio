/**
 * Decides whether the studio reads and writes through Supabase.
 *
 * The configuration decides, not where the app happens to run. Pointing
 * `SUPABASE_URL` at the local Docker project or at a cloud project changes only
 * where the data lives; the app behaves the same either way.
 *
 * The in-memory store exists for tests and for a first look before any database
 * is configured. It is never chosen silently when a Supabase project is
 * configured, because that produced an app that looked configured while storing
 * nothing.
 */
export function usesSupabasePersistence(
  env: {
    NODE_ENV?: string;
    BUNKER_PERSISTENCE_MODE?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
  } = process.env,
): boolean {
  // A hosted deployment never falls back to a process-memory store: with no
  // database configured it must fail loudly rather than pretend to persist.
  if (env.NODE_ENV === 'production') return true;
  if (env.BUNKER_PERSISTENCE_MODE === 'memory') return false;
  if (env.BUNKER_PERSISTENCE_MODE === 'supabase') return true;
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

export type PersistenceTarget = {
  mode: 'SUPABASE' | 'MEMORY';
  /** Host only: the project URL can carry a project reference, never a key. */
  host: string | null;
  /** True when the configured project is the local Docker one. */
  local: boolean;
};

/**
 * Describes the active storage target so the UI can show which database is in
 * use. This is diagnostic only and never includes a credential.
 */
export function persistenceTarget(
  env: { SUPABASE_URL?: string | undefined } = process.env as { SUPABASE_URL?: string },
  usesSupabase = usesSupabasePersistence(),
): PersistenceTarget {
  if (!usesSupabase) return { mode: 'MEMORY', host: null, local: true };
  let host: string | null = null;
  try {
    host = env.SUPABASE_URL ? new URL(env.SUPABASE_URL).host : null;
  } catch {
    host = null;
  }
  const local = host ? /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host) : false;
  return { mode: 'SUPABASE', host, local };
}
