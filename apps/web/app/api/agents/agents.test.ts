import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as createProject } from '../organizations/[organizationId]/projects/route';
import { POST as createTeam } from '../organizations/[organizationId]/teams/route';
import { GET as listAgents, POST as createAgent } from './route';
import {
  DELETE as archiveAssignment,
  GET as listAssignments,
  POST as createAssignment,
} from './[agentId]/assignments/route';
import { DELETE as archiveAgent, PATCH as updateAgent } from './[agentId]/route';
import { GET as getAgentMetrics } from './[agentId]/metrics/route';
import { GET as listActivity } from '../activity/route';

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
          avatarAssetId: '00000000-0000-0000-0000-000000000001',
          skills: ['backend'],
          tools: ['repository workspace'],
          permissions: ['repo.read', 'repo.write'],
          providerConnectionId: '00000000-0000-4000-8000-000000000001',
          providerModelId: 'fake-default',
          runtimeType: 'OPENAI_COMPATIBLE',
          reasoningEffort: 'medium',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const createdAgent = (await created.json()).agent;
    const agentId = createdAgent.id;
    expect(createdAgent.skills).toEqual(['backend']);
    expect(createdAgent.permissions).toEqual(['repo.read', 'repo.write']);
    const activityAfterCreate = await listActivity(new Request('http://localhost', { headers }));
    expect((await activityAfterCreate.json()).activity).toMatchObject([
      { eventType: 'AGENT_CREATED', aggregateType: 'agent', aggregateId: agentId },
    ]);

    const updated = await updateAgent(
      new Request(`http://localhost/api/agents/${agentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          title: 'Senior Backend Engineer',
          tools: ['repository workspace', 'CI'],
        }),
      }),
      { params: Promise.resolve({ agentId }) },
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).agent).toMatchObject({
      title: 'Senior Backend Engineer',
      tools: ['repository workspace', 'CI'],
    });
    const activityAfterUpdate = await listActivity(new Request('http://localhost', { headers }));
    expect((await activityAfterUpdate.json()).activity).toHaveLength(2);

    const listed = await listAgents(new Request('http://localhost/api/agents', { headers }));
    expect((await listed.json()).agents).toHaveLength(1);

    const metrics = await getAgentMetrics(new Request('http://localhost', { headers }), {
      params: Promise.resolve({ agentId }),
    });
    expect(metrics.status).toBe(200);
    expect((await metrics.json()).metrics).toMatchObject({
      tasksCompleted: 0,
      firstReviewPassRate: 0,
      averageTaskCost: 0,
      medianCycleTimeMs: 0,
    });

    const archived = await archiveAgent(
      new Request(`http://localhost/api/agents/${agentId}`, { method: 'DELETE', headers }),
      { params: Promise.resolve({ agentId }) },
    );
    expect(archived.status).toBe(204);
    const afterArchive = await listAgents(new Request('http://localhost/api/agents', { headers }));
    expect((await afterArchive.json()).agents).toEqual([]);
    const activityAfterArchive = await listActivity(new Request('http://localhost', { headers }));
    expect((await activityAfterArchive.json()).activity).toHaveLength(3);
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
          providerConnectionId: '00000000-0000-4000-8000-000000000001',
          providerModelId: 'fake-default',
          runtimeType: 'OPENAI_COMPATIBLE',
          reasoningEffort: 'medium',
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it('manages tenant-scoped team and project assignments', async () => {
    const owner = `assignment-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationResponse = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Assignment Registry' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id;
    const teamResponse = await createTeam(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Platform' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const teamId = (await teamResponse.json()).team.id;
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Assignment API', teamId }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id;
    const agentResponse = await createAgent(
      new Request('http://localhost/api/agents', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({
          name: 'Assigned Builder',
          roleKey: 'backend',
          title: 'Backend Engineer',
          providerConnectionId: '00000000-0000-4000-8000-000000000001',
          providerModelId: 'fake-default',
          runtimeType: 'OPENAI_COMPATIBLE',
          reasoningEffort: 'medium',
        }),
      }),
    );
    const agentId = (await agentResponse.json()).agent.id;
    const assignmentResponse = await createAssignment(
      new Request('http://localhost', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({ teamId, projectId }),
      }),
      { params: Promise.resolve({ agentId }) },
    );
    expect(assignmentResponse.status).toBe(201);
    const assignmentId = (await assignmentResponse.json()).assignment.id;
    const listed = await listAssignments(
      new Request('http://localhost', {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
      { params: Promise.resolve({ agentId }) },
    );
    expect((await listed.json()).assignments).toHaveLength(1);
    const assignmentActivity = await listActivity(
      new Request('http://localhost', {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
    );
    expect((await assignmentActivity.json()).activity).toContainEqual(
      expect.objectContaining({ eventType: 'AGENT_ASSIGNMENT_CREATED' }),
    );
    const metrics = await getAgentMetrics(
      new Request('http://localhost', {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
      { params: Promise.resolve({ agentId }) },
    );
    expect(metrics.status).toBe(200);
    expect(await metrics.json()).toMatchObject({ assignmentCount: 1, scopedProjectCount: 1 });
    const archived = await archiveAssignment(
      new Request(`http://localhost?assignmentId=${assignmentId}`, {
        method: 'DELETE',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
    );
    expect(archived.status).toBe(204);
    const afterArchive = await listAssignments(
      new Request('http://localhost', {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
      { params: Promise.resolve({ agentId }) },
    );
    expect((await afterArchive.json()).assignments).toEqual([]);
  });
});
