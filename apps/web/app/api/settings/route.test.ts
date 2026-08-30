import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { GET } from './route';

describe('GET /api/settings', () => {
  it('returns provider and worker settings without secrets', async () => {
    const userId = `settings-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const created = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Settings Studio' }),
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = await created.json();
    expect(createdPayload.organization).toBeTruthy();
    const organizationId = createdPayload.organization.id as string;
    const response = await GET(
      new Request('http://localhost/api/settings', {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      runtime: { mode: 'local-fake', providerType: 'fake' },
      providers: [{ displayName: 'Local fake provider', status: 'READY' }],
      workers: [],
    });
    expect(JSON.stringify(payload)).not.toContain('API_PROVIDER_KEY');
  });
});
