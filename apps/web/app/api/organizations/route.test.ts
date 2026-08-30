import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

describe('organization API', () => {
  it('requires an authenticated identity', async () => {
    expect((await GET(new Request('http://localhost/api/organizations'))).status).toBe(401);
  });

  it('creates and lists an organization for its owner', async () => {
    const headers = {
      'content-type': 'application/json',
      'x-bunker-user-id': `test-${crypto.randomUUID()}`,
    };
    const createResponse = await POST(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Product Studio' }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const listResponse = await GET(new Request('http://localhost/api/organizations', { headers }));
    expect((await listResponse.json()).organizations).toContainEqual(created.organization);
  });
});
