import { describe, expect, it } from 'vitest';
import { persistenceTarget, usesSupabasePersistence } from './_persistence';

const CLOUD = 'https://abcdefgh.supabase.co';
const LOCAL = 'http://127.0.0.1:55421';

describe('usesSupabasePersistence', () => {
  it('uses Supabase whenever a project is configured, local or cloud', () => {
    expect(usesSupabasePersistence({ SUPABASE_URL: LOCAL, SUPABASE_ANON_KEY: 'anon' })).toBe(true);
    expect(usesSupabasePersistence({ SUPABASE_URL: CLOUD, SUPABASE_ANON_KEY: 'anon' })).toBe(true);
  });

  it('falls back to memory only when no project is configured', () => {
    expect(usesSupabasePersistence({})).toBe(false);
    // A URL without a key cannot reach a project, so it is not configured.
    expect(usesSupabasePersistence({ SUPABASE_URL: LOCAL })).toBe(false);
  });

  it('honours an explicit mode over the configuration', () => {
    expect(
      usesSupabasePersistence({
        BUNKER_PERSISTENCE_MODE: 'memory',
        SUPABASE_URL: CLOUD,
        SUPABASE_ANON_KEY: 'anon',
      }),
    ).toBe(false);
    expect(usesSupabasePersistence({ BUNKER_PERSISTENCE_MODE: 'supabase' })).toBe(true);
  });

  it('never falls back to memory in production', () => {
    expect(usesSupabasePersistence({ NODE_ENV: 'production' })).toBe(true);
    expect(
      usesSupabasePersistence({ NODE_ENV: 'production', BUNKER_PERSISTENCE_MODE: 'memory' }),
    ).toBe(true);
  });

  it('does not decide from the run mode when a project is configured', () => {
    // Running with `next dev` against the cloud project must behave the same as
    // running hosted: only the data location differs.
    expect(
      usesSupabasePersistence({
        NODE_ENV: 'development',
        SUPABASE_URL: CLOUD,
        SUPABASE_ANON_KEY: 'anon',
      }),
    ).toBe(true);
  });
});

describe('persistenceTarget', () => {
  it('reports the local Docker project', () => {
    expect(persistenceTarget({ SUPABASE_URL: LOCAL }, true)).toEqual({
      mode: 'SUPABASE',
      host: '127.0.0.1:55421',
      local: true,
    });
  });

  it('reports a cloud project as not local', () => {
    expect(persistenceTarget({ SUPABASE_URL: CLOUD }, true)).toEqual({
      mode: 'SUPABASE',
      host: 'abcdefgh.supabase.co',
      local: false,
    });
  });

  it('never exposes a credential', () => {
    const target = persistenceTarget(
      { SUPABASE_URL: 'https://user:secret@abcdefgh.supabase.co' },
      true,
    );
    expect(JSON.stringify(target)).not.toContain('secret');
  });

  it('reports the memory store with no host', () => {
    expect(persistenceTarget({ SUPABASE_URL: CLOUD }, false)).toEqual({
      mode: 'MEMORY',
      host: null,
      local: true,
    });
  });

  it('tolerates a malformed project URL', () => {
    expect(persistenceTarget({ SUPABASE_URL: 'not a url' }, true).host).toBeNull();
  });
});
