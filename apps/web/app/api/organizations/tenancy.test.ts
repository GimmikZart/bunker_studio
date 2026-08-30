import { describe, expect, it } from 'vitest';
import { POST as createProject } from './[organizationId]/projects/route';
import { POST as createTeam } from './[organizationId]/teams/route';
import { POST as createOrganization } from '../organizations/route';

describe('tenancy CRUD routes', () => {
  it('creates team and project only for the organization owner', async () => {
    const owner = `owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationResponse = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Delivery' }),
      }),
    );
    const { organization } = await organizationResponse.json();
    const teamResponse = await createTeam(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Platform' }),
      }),
      { params: Promise.resolve({ organizationId: organization.id }) },
    );
    expect(teamResponse.status).toBe(201);
    const team = (await teamResponse.json()).team;
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'API', teamId: team.id }),
      }),
      { params: Promise.resolve({ organizationId: organization.id }) },
    );
    expect(projectResponse.status).toBe(201);
  });

  it('rejects a cross-organization writer', async () => {
    const response = await createTeam(
      new Request('http://localhost', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bunker-user-id': `intruder-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ name: 'Nope' }),
      }),
      { params: Promise.resolve({ organizationId: crypto.randomUUID() }) },
    );
    expect(response.status).toBe(403);
  });
});
