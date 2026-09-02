import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { DELETE, GET, POST } from './route';

describe('structured memories API', () => {
  it('creates, retrieves bounded matches, and deletes a memory', async () => {
    const owner = `memory-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organization = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Memory org' }),
      }),
    );
    const organizationId = (await organization.json()).organization.id;
    const tenantHeaders = { ...headers, 'x-bunker-organization-id': organizationId };
    const created = await POST(
      new Request('http://localhost/api/memories', {
        method: 'POST',
        headers: tenantHeaders,
        body: JSON.stringify({
          content: 'Use a durable queue for retry',
          type: 'DECISION',
          importance: 90,
        }),
      }),
    );
    expect(created.status).toBe(201);
    const memory = (await created.json()).memory;
    const found = await GET(
      new Request('http://localhost/api/memories?query=durable%20queue', {
        headers: tenantHeaders,
      }),
    );
    expect((await found.json()).memories[0]).toMatchObject({
      content: expect.stringContaining('durable queue'),
      source: `memory:${memory.id}`,
    });
    expect(
      (
        await DELETE(
          new Request(`http://localhost/api/memories?memoryId=${memory.id}`, {
            method: 'DELETE',
            headers: tenantHeaders,
          }),
        )
      ).status,
    ).toBe(204);
  });
});
