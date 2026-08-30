import { describe, expect, it } from 'vitest';
import { POST as createAgent } from '../agents/route';
import { POST as createOrganization } from './route';
import { POST as createTeam } from './[organizationId]/teams/route';
import { POST as createProject } from './[organizationId]/projects/route';
import { GET as exportOrganization } from './[organizationId]/export/route';
import { POST as importOrganization } from './import/route';

describe('organization portability routes', () => {
  it('exports tenant data and imports it with new ids and provider re-auth status', async () => {
    const owner = `portability-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationResponse = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Portable Workspace' }),
      }),
    );
    const organization = (await organizationResponse.json()).organization;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organization.id };
    const teamResponse = await createTeam(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Platform' }),
      }),
      { params: Promise.resolve({ organizationId: organization.id }) },
    );
    const team = (await teamResponse.json()).team;
    await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'API', teamId: team.id }),
      }),
      { params: Promise.resolve({ organizationId: organization.id }) },
    );
    await createAgent(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Builder',
          roleKey: 'backend',
          title: 'Backend Engineer',
          personality: {},
          providerBindingId: 'local-ollama',
        }),
      }),
    );

    const exported = await exportOrganization(new Request('http://localhost', { headers }), {
      params: Promise.resolve({ organizationId: organization.id }),
    });
    expect(exported.status).toBe(200);
    const pack = await exported.json();
    expect(pack.manifest.schemaVersion).toBe(1);
    expect(pack.teams).toHaveLength(1);
    expect(pack.projects).toHaveLength(1);
    expect(pack.agents).toHaveLength(1);

    const imported = await importOrganization(
      new Request('http://localhost/api/organizations/import', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify(pack),
      }),
    );
    expect(imported.status).toBe(201);
    const importedPayload = await imported.json();
    expect(importedPayload.organization.id).not.toBe(organization.id);
    expect(importedPayload.imported).toMatchObject({ teams: 1, projects: 1, agents: 1 });
    expect(importedPayload.providerStatus).toBe('REQUIRES_REAUTH');
  });

  it('does not export an organization the actor cannot access', async () => {
    const response = await exportOrganization(
      new Request('http://localhost', {
        headers: {
          'x-bunker-user-id': `portability-intruder-${crypto.randomUUID()}`,
        },
      }),
      { params: Promise.resolve({ organizationId: crypto.randomUUID() }) },
    );
    expect(response.status).toBe(404);
  });
});
