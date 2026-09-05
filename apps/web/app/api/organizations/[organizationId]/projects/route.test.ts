import { describe, expect, it } from 'vitest';
import { POST as createProject } from './route';
import { POST as createOrganization } from '../../route';

async function organization(name: string) {
  const userId = `projects-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
  const response = await createOrganization(
    new Request('http://localhost/api/organizations', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ name }),
    }),
  );
  const organizationId = (await response.json()).organization.id as string;
  return {
    organizationId,
    headers: { ...baseHeaders, 'x-bunker-organization-id': organizationId },
  };
}

function create(
  headers: Record<string, string>,
  organizationId: string,
  body: Record<string, unknown>,
) {
  return createProject(
    new Request(`http://localhost/api/organizations/${organizationId}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ organizationId }) },
  );
}

describe('project creation failures', () => {
  it('names the project whose name is already taken instead of blaming the payload', async () => {
    const { organizationId, headers } = await organization('Zart Lab');
    expect((await create(headers, organizationId, { name: 'Vrsus App' })).status).toBe(201);

    const conflict = await create(headers, organizationId, { name: 'Vrsus App' });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toContain('Vrsus App');
  });

  it('says which field is wrong when the payload really is malformed', async () => {
    const { organizationId, headers } = await organization('Zart Lab Two');
    const response = await create(headers, organizationId, { name: '' });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('name');
  });

  it('accepts a project with an empty description', async () => {
    const { organizationId, headers } = await organization('Zart Lab Three');
    const response = await create(headers, organizationId, { name: 'Site', description: '' });
    expect(response.status).toBe(201);
  });
});
