import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../../route';
import { DELETE, GET, POST } from './route';

describe('organization member administration', () => {
  it('keeps membership changes owner-only and prevents owner removal', async () => {
    const owner = `member-owner-${crypto.randomUUID()}`;
    const admin = `member-admin-${crypto.randomUUID()}`;
    const member = `member-user-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const created = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Member controls' }),
      }),
    );
    const organizationId = (await created.json()).organization.id as string;
    const ownerHeaders = { ...baseHeaders, 'x-bunker-organization-id': organizationId };

    const addedAdmin = await POST(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ userId: admin, role: 'ADMIN' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(addedAdmin.status).toBe(201);

    const adminHeaders = {
      'content-type': 'application/json',
      'x-bunker-user-id': admin,
      'x-bunker-organization-id': organizationId,
    };
    const deniedInvite = await POST(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ userId: member, role: 'VIEWER' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(deniedInvite.status).toBe(403);

    const addedMember = await POST(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ userId: member, role: 'VIEWER' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(addedMember.status).toBe(201);
    const members = await GET(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        headers: adminHeaders,
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect((await members.json()).members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner, role: 'OWNER' }),
        expect.objectContaining({ userId: admin, role: 'ADMIN' }),
        expect.objectContaining({ userId: member, role: 'VIEWER' }),
      ]),
    );

    const deniedRemoval = await DELETE(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ userId: member }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(deniedRemoval.status).toBe(403);

    const removed = await DELETE(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        method: 'DELETE',
        headers: ownerHeaders,
        body: JSON.stringify({ userId: member }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(removed.status).toBe(204);
    const ownerRemoval = await DELETE(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        method: 'DELETE',
        headers: ownerHeaders,
        body: JSON.stringify({ userId: owner }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(ownerRemoval.status).toBe(403);
  });
});
