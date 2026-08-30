import { describe, expect, it } from 'vitest';
import { POST as signup } from './signup/route';

describe('Supabase Auth routes', () => {
  it('fails closed when cloud auth is not configured', async () => {
    const response = await signup(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'owner@example.com', password: 'password123' }),
      }),
    );
    expect(response.status).toBe(503);
  });
});
