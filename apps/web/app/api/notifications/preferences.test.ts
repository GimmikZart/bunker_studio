import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { GET, PATCH } from './preferences/route';

describe('notification preference routes', () => {
  it('returns defaults and persists category choices for the current user', async () => {
    const owner = `notification-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationResponse = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Notification Preferences' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };

    const defaults = await GET(
      new Request('http://localhost/api/notifications/preferences', { headers }),
    );
    expect((await defaults.json()).preferences).toEqual({
      APPROVAL: true,
      SECURITY: true,
      BUDGET: true,
      QUOTA: true,
      WORKFLOW: true,
    });

    const saved = await PATCH(
      new Request('http://localhost/api/notifications/preferences', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          APPROVAL: false,
          SECURITY: true,
          BUDGET: false,
          QUOTA: true,
          WORKFLOW: false,
        }),
      }),
    );
    expect(saved.status).toBe(200);
    expect((await saved.json()).preferences.APPROVAL).toBe(false);
  });

  it('rejects malformed preferences and unknown organization access', async () => {
    const malformed = await PATCH(
      new Request('http://localhost/api/notifications/preferences', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-bunker-user-id': 'owner',
          'x-bunker-organization-id': crypto.randomUUID(),
        },
        body: JSON.stringify({ APPROVAL: false }),
      }),
    );
    expect(malformed.status).toBe(400);

    const unknown = await GET(
      new Request('http://localhost/api/notifications/preferences', {
        headers: {
          'x-bunker-user-id': `intruder-${crypto.randomUUID()}`,
          'x-bunker-organization-id': crypto.randomUUID(),
        },
      }),
    );
    expect(unknown.status).toBe(403);
  });
});
