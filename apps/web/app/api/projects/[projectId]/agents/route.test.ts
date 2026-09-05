import { describe, expect, it } from 'vitest';
import { DELETE as removeAgent, GET as listTeam, POST as assignAgents } from './route';
import { POST as createOrganization } from '../../../organizations/route';
import { POST as createProject } from '../../../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../../../agents/route';

async function studio() {
  const userId = `team-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
  const organizationId = (
    await (
      await createOrganization(
        new Request('http://localhost/api/organizations', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ name: 'Team Studio' }),
        }),
      )
    ).json()
  ).organization.id as string;
  const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };

  async function project(name: string) {
    const response = await createProject(
      new Request(`http://localhost/api/organizations/${organizationId}/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    return (await response.json()).project.id as string;
  }

  async function agent(name: string, roleKey: string) {
    const response = await createAgent(
      new Request('http://localhost/api/agents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          roleKey,
          title: `${name} title`,
          skills: [roleKey],
          providerConnectionId: '00000000-0000-4000-8000-000000000001',
          providerModelId: 'fake-default',
          runtimeType: 'OPENAI_COMPATIBLE',
          reasoningEffort: 'medium',
        }),
      }),
    );
    return (await response.json()).agent.id as string;
  }

  return { headers, organizationId, project, agent };
}

function team(headers: Record<string, string>, projectId: string) {
  return listTeam(new Request(`http://localhost/api/projects/${projectId}/agents`, { headers }), {
    params: Promise.resolve({ projectId }),
  });
}

describe('the team of a project', () => {
  it('puts an agent on a project and stops offering it as available', async () => {
    const studioContext = await studio();
    const projectId = await studioContext.project('Delivery');
    const agentId = await studioContext.agent('Marta', 'frontend');

    const before = await (await team(studioContext.headers, projectId)).json();
    expect(before.members).toEqual([]);
    expect(before.available.map((agent: { id: string }) => agent.id)).toEqual([agentId]);

    const assigned = await assignAgents(
      new Request(`http://localhost/api/projects/${projectId}/agents`, {
        method: 'POST',
        headers: studioContext.headers,
        body: JSON.stringify({ agentIds: [agentId] }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect(assigned.status).toBe(201);

    const after = await (await team(studioContext.headers, projectId)).json();
    expect(after.members).toHaveLength(1);
    expect(after.members[0]).toMatchObject({ id: agentId, name: 'Marta', roleKey: 'frontend' });
    expect(after.available).toEqual([]);
  });

  it('assigning twice does not put the same agent on the project twice', async () => {
    const studioContext = await studio();
    const projectId = await studioContext.project('Delivery');
    const agentId = await studioContext.agent('Marta', 'frontend');
    for (let attempt = 0; attempt < 2; attempt += 1)
      await assignAgents(
        new Request(`http://localhost/api/projects/${projectId}/agents`, {
          method: 'POST',
          headers: studioContext.headers,
          body: JSON.stringify({ agentIds: [agentId] }),
        }),
        { params: Promise.resolve({ projectId }) },
      );
    expect((await (await team(studioContext.headers, projectId)).json()).members).toHaveLength(1);
  });

  it('moves an agent between projects in one request', async () => {
    const studioContext = await studio();
    const from = await studioContext.project('Old work');
    const to = await studioContext.project('New work');
    const agentId = await studioContext.agent('Kenji', 'reviewer');
    await assignAgents(
      new Request(`http://localhost/api/projects/${from}/agents`, {
        method: 'POST',
        headers: studioContext.headers,
        body: JSON.stringify({ agentIds: [agentId] }),
      }),
      { params: Promise.resolve({ projectId: from }) },
    );

    await assignAgents(
      new Request(`http://localhost/api/projects/${to}/agents`, {
        method: 'POST',
        headers: studioContext.headers,
        body: JSON.stringify({ agentIds: [agentId], fromProjectId: from }),
      }),
      { params: Promise.resolve({ projectId: to }) },
    );

    expect((await (await team(studioContext.headers, from)).json()).members).toEqual([]);
    expect((await (await team(studioContext.headers, to)).json()).members).toHaveLength(1);
  });

  it('takes an agent off a project', async () => {
    const studioContext = await studio();
    const projectId = await studioContext.project('Delivery');
    const agentId = await studioContext.agent('Marta', 'frontend');
    await assignAgents(
      new Request(`http://localhost/api/projects/${projectId}/agents`, {
        method: 'POST',
        headers: studioContext.headers,
        body: JSON.stringify({ agentIds: [agentId] }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const removed = await removeAgent(
      new Request(`http://localhost/api/projects/${projectId}/agents?agentId=${agentId}`, {
        method: 'DELETE',
        headers: studioContext.headers,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect(removed.status).toBe(204);
    expect((await (await team(studioContext.headers, projectId)).json()).members).toEqual([]);
  });

  it('refuses a project that belongs to another organization', async () => {
    const owner = await studio();
    const stranger = await studio();
    const projectId = await owner.project('Private');
    const response = await team(stranger.headers, projectId);
    expect(response.status).toBe(404);
  });
});
