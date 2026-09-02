import { describe, expect, it } from 'vitest';
import { POST as createAgent } from '../agents/route';
import { POST as createAssignment } from '../agents/[agentId]/assignments/route';
import { POST as createOrganization } from './route';
import { POST as createTeam } from './[organizationId]/teams/route';
import { POST as createProject } from './[organizationId]/projects/route';
import { POST as addMember } from './[organizationId]/members/route';
import { GET as exportOrganization } from './[organizationId]/export/route';
import { POST as importOrganization } from './import/route';
import { POST as createTask } from '../tasks/route';
import { GET as listTasks } from '../tasks/route';

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
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'API', teamId: team.id }),
      }),
      { params: Promise.resolve({ organizationId: organization.id }) },
    );
    const agentResponse = await createAgent(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Builder',
          roleKey: 'backend',
          title: 'Backend Engineer',
          personality: {},
          providerConnectionId: '00000000-0000-4000-8000-000000000001',
          providerModelId: 'fake-default',
          runtimeType: 'OPENAI_COMPATIBLE',
          reasoningEffort: 'medium',
        }),
      }),
    );
    const agent = (await agentResponse.json()).agent;
    const project = (await projectResponse.json()).project;
    const assignment = await createAssignment(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ teamId: team.id, projectId: project.id }),
      }),
      { params: Promise.resolve({ agentId: agent.id }) },
    );
    expect(assignment.status).toBe(201);
    const firstTask = await createTask(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: project.id,
          title: 'Schema task',
          taskType: 'BACKEND',
          requiredCapability: 'ollama',
        }),
      }),
    );
    const firstTaskId = (await firstTask.json()).task.id;
    await createTask(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: project.id,
          title: 'Dependent task',
          taskType: 'BACKEND',
          dependencies: [firstTaskId],
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
    expect(pack.assignments).toHaveLength(1);
    expect(pack.tasks).toHaveLength(2);
    pack.tasks.reverse();

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
    expect(importedPayload.imported).toMatchObject({
      teams: 1,
      projects: 1,
      agents: 1,
      assignments: 1,
      tasks: 2,
    });
    expect(importedPayload.providerStatus).toBe('REQUIRES_REAUTH');
    const importedTasks = await listTasks(
      new Request('http://localhost', {
        headers: {
          ...baseHeaders,
          'x-bunker-organization-id': importedPayload.organization.id,
        },
      }),
    );
    const importedTaskPayload = await importedTasks.json();
    expect(importedTaskPayload.tasks).toHaveLength(2);
    expect(
      importedTaskPayload.tasks.find(
        (task: { dependencies: string[] }) => task.dependencies.length,
      ),
    ).toMatchObject({ state: 'DRAFT' });
    expect(
      importedTaskPayload.tasks.find((task: { title: string }) => task.title === 'Schema task'),
    ).toMatchObject({ requiredCapability: 'ollama' });
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

  it('does not allow an admin to export an organization', async () => {
    const owner = `portability-owner-${crypto.randomUUID()}`;
    const admin = `portability-admin-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const created = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Owner export only' }),
      }),
    );
    const organizationId = (await created.json()).organization.id as string;
    const ownerHeaders = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const added = await addMember(
      new Request(`http://localhost/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({ userId: admin, role: 'ADMIN' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(added.status).toBe(201);
    const response = await exportOrganization(
      new Request(`http://localhost/api/organizations/${organizationId}/export`, {
        headers: { 'x-bunker-user-id': admin },
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(response.status).toBe(403);
  });
});
