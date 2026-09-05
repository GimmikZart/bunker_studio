import { describe, expect, it } from 'vitest';
import { githubStorageFailure } from './_github-errors';

describe('GitHub storage failures', () => {
  it('names the pending migration instead of answering with a bare failure', async () => {
    const response = githubStorageFailure(
      new Error('relation "public.github_connections" does not exist'),
    );
    expect(response.status).toBe(503);
    const { error } = await response.json();
    expect(error).toContain('supabase db push');
  });

  it('reports any other database failure with its own reason', async () => {
    const response = githubStorageFailure(new Error('connection terminated unexpectedly'));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain('connection terminated unexpectedly');
  });
});
