import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { GET, PATCH, POST } from './route';

describe('notification inbox routes', () => {
  it('persists an unread notification, exposes its deep link, and marks it read', async () => {
    const userId = `notification-inbox-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const organizationResponse = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Notification Inbox' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id as string;
    const scopedHeaders = { ...headers, 'x-bunker-organization-id': organizationId };
    const created = await POST(
      new Request('http://localhost/api/notifications', {
        method: 'POST',
        headers: scopedHeaders,
        body: JSON.stringify({
          userId,
          category: 'APPROVAL',
          severity: 'HIGH',
          title: 'Approval required',
          body: 'Review the protected task.',
          deepLink: '/approvals?approvalId=example',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const notificationId = (await created.json()).notification.id as string;

    const unread = await GET(
      new Request('http://localhost/api/notifications', { headers: scopedHeaders }),
    );
    expect(await unread.json()).toMatchObject({
      unread: 1,
      notifications: [
        expect.objectContaining({ id: notificationId, deepLink: '/approvals?approvalId=example' }),
      ],
    });

    const marked = await PATCH(
      new Request('http://localhost/api/notifications', {
        method: 'PATCH',
        headers: scopedHeaders,
        body: JSON.stringify({ notificationId }),
      }),
    );
    expect(marked.status).toBe(204);
    const read = await GET(
      new Request('http://localhost/api/notifications', { headers: scopedHeaders }),
    );
    expect((await read.json()).unread).toBe(0);
  });
});
