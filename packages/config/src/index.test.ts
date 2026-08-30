import { describe, expect, it } from 'vitest';
import { loadEnv } from './index';

describe('environment configuration', () => {
  it('provides safe local defaults', () => {
    expect(loadEnv({}).DATABASE_URL).toContain('127.0.0.1');
  });

  it('requires the application encryption key in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow('STUDIO_MASTER_KEY');
  });
});
