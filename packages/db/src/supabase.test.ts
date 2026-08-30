import { describe, expect, it } from 'vitest';
import { createStudioSupabaseClient } from './supabase';

describe('Supabase auth adapter', () => {
  it('constructs through an injected cookie boundary', () => {
    const client = createStudioSupabaseClient(
      { getAll: () => [], setAll: () => undefined },
      { url: 'http://127.0.0.1:55421', anonKey: 'anon' },
    );
    expect(client.auth).toBeDefined();
  });
});
