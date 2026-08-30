import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { GET as listAgents, POST as createAgent } from './route';
import { DELETE as archiveAgent, PATCH as updateAgent } from './[agentId]/route';

describe('agent registry routes', () => {
  it('creates, updates, lists and archives an agent within its organization', async () => {
    const owner = `agent-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationResponse = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Agent Registry' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };

    const created = await createAgent(
      new Request('http://localhost/api/agents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Builder',
          roleKey: 'backend',
          title: 'Backend Engineer',
          personality: { tone: 'precise' },
          providerBindingId: 'local-ollama',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const agentId = (await created.json()).agent.id;

    const updated = await updateAgent(
      new Request(`http://localhost/api/agents/${agentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ title: 'Senior Backend Engineer' }),
      }),
      { params: Promise.resolve({ agentId }) },
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).agent.title).toBe('Senior Backend Engineer');

    const listed = await listAgents(new Request('http://localhost/api/agents', { headers }));
    expect((await listed.json()).agents).toHaveLength(1);

    const archived = await archiveAgent(
      new Request(`http://localhost/api/agents/${agentId}`, { method: 'DELETE', headers }),
      { params: Promise.resolve({ agentId }) },
    );
    expect(archived.status).toBe(204);
    const afterArchive = await listAgents(new Request('http://localhost/api/agents', { headers }));
    expect((await afterArchive.json()).agents).toEqual([]);
  });

  it('rejects agent writes from a user outside the organization', async () => {
    const response = await createAgent(
      new Request('http://localhost/api/agents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bunker-user-id': `agent-intruder-${crypto.randomUUID()}`,
          'x-bunker-organization-id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          name: 'Blocked',
          roleKey: 'backend',
          title: 'Backend Engineer',
          providerBindingId: 'local-ollama',
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
