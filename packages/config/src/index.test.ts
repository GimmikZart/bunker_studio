import { describe, expect, it } from 'vitest';
import { loadEnv } from './index';

describe('environment configuration', () => {
  it('provides safe local defaults', () => {
    expect(loadEnv({})).toMatchObject({
      SUPABASE_URL: 'http://127.0.0.1:55421',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55422/postgres',
      AGENT_CHAT_ESTIMATED_COST: 0.01,
    });
  });

  it('requires the application encryption key in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow('STUDIO_MASTER_KEY');
  });
});
