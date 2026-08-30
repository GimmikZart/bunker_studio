import { expect, test, type APIRequestContext } from '@playwright/test';

test.setTimeout(120_000);

async function createOrganization(request: APIRequestContext, userId: string, name: string) {
  const response = await request.post('/api/organizations', {
    headers: { 'content-type': 'application/json', 'x-bunker-user-id': userId },
    data: { name },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).organization as { id: string };
}

test('tenant CRUD and cross-organization isolation are enforced', async ({ request }) => {
  const userA = `e2e-a-${Date.now()}`;
  const userB = `e2e-b-${Date.now()}`;
  const organization = await createOrganization(request, userA, `API Org ${userA}`);
  const headers = { 'content-type': 'application/json', 'x-bunker-user-id': userA };
  const team = await request.post(`/api/organizations/${organization.id}/teams`, {
    headers,
    data: { name: 'Platform' },
  });
  expect(team.status()).toBe(201);
  const project = await request.post(`/api/organizations/${organization.id}/projects`, {
    headers,
    data: { name: 'Core API' },
  });
  expect(project.status()).toBe(201);
  const intruder = await request.get(`/api/organizations/${organization.id}/teams`, {
    headers: { 'x-bunker-user-id': userB },
  });
  expect(intruder.status()).toBe(403);
});

test('design, staffing confirmation and bounded memory search remain gated', async ({
  request,
}) => {
  const userId = `e2e-gates-${Date.now()}`;
  const organization = await createOrganization(request, userId, `Gates ${userId}`);
  const headers = {
    'content-type': 'application/json',
    'x-bunker-user-id': userId,
    'x-bunker-organization-id': organization.id,
  };
  const design = await request.post('/api/designs', {
    headers,
    data: {
      versionNumber: 1,
      status: 'SUBMITTED',
      spec: { screen: 'home' },
      rationale: 'test',
      previewArtifactIds: [],
    },
  });
  expect(design.status()).toBe(201);
  const version = (await design.json()).version as { id: string; status: string };
  expect(version.status).toBe('SUBMITTED');
  const approved = await request.post(`/api/designs/${version.id}/approve`, { headers });
  expect(approved.status()).toBe(200);
  const proposals = await request.post('/api/staffing/proposals', {
    headers,
    data: { requiredRoles: ['frontend'], budget: 2 },
  });
  expect((await proposals.json()).proposals).toHaveLength(1);
  const memory = await request.post('/api/memories', {
    headers,
    data: {
      type: 'DECISION',
      content: 'We chose the durable queue for restart safety',
      importance: 90,
    },
  });
  expect(memory.status()).toBe(201);
  const search = await request.get('/api/memories?query=durable queue restart', { headers });
  expect((await search.json()).memories[0].source).toContain('memory:');
});

test('local worker registration advertises capability and accepts a heartbeat', async ({
  request,
}) => {
  const userId = `e2e-worker-${Date.now()}`;
  const organization = await createOrganization(request, userId, `Worker ${userId}`);
  const headers = {
    'content-type': 'application/json',
    'x-bunker-user-id': userId,
    'x-bunker-organization-id': organization.id,
  };
  const registration = await request.post('/api/workers/register', {
    headers,
    data: { name: 'Ollama node', capabilities: ['ollama'], maxConcurrent: 2 },
  });
  expect(registration.status()).toBe(201);
  const node = (await registration.json()).worker as { id: string; capabilities: string[] };
  expect(node.capabilities).toContain('ollama');
  const heartbeat = await request.post('/api/workers/heartbeat', {
    headers,
    data: { nodeId: node.id },
  });
  expect(heartbeat.status()).toBe(200);
});

test('meetings, approvals, costs, notifications and repository metadata are tenant-scoped', async ({
  request,
}) => {
  const userId = `e2e-operations-${Date.now()}`;
  const organization = await createOrganization(request, userId, `Operations ${userId}`);
  const headers = {
    'content-type': 'application/json',
    'x-bunker-user-id': userId,
    'x-bunker-organization-id': organization.id,
  };
  const projectResponse = await request.post(`/api/organizations/${organization.id}/projects`, {
    headers,
    data: { name: 'Operations project' },
  });
  const project = (await projectResponse.json()).project as { id: string };
  const agents = await Promise.all(
    ['Lead', 'Reviewer'].map((title) =>
      request.post('/api/agents', {
        headers,
        data: { name: title, roleKey: title.toLowerCase(), title, providerBindingId: 'fake' },
      }),
    ),
  );
  const agentIds = await Promise.all(
    agents.map(async (response) => (await response.json()).agent.id as string),
  );
  const editedAgent = await request.patch(`/api/agents/${agentIds[0]}`, {
    headers,
    data: { name: 'Lead Architect', providerBindingId: 'new-model' },
  });
  expect((await editedAgent.json()).agent.providerBindingId).toBe('new-model');
  const chat = await request.post(`/api/agents/${agentIds[0]}/chat`, {
    headers,
    data: { content: 'Summarize the architecture boundary.' },
  });
  expect((await chat.json()).message.content).toContain('Summarize');
  const meetingResponse = await request.post('/api/meetings', {
    headers,
    data: {
      projectId: project.id,
      title: 'Architecture review',
      meetingType: 'ARCHITECTURE',
      agenda: ['Choose the durable boundary'],
      agentIds,
      maxRounds: 2,
    },
  });
  expect(meetingResponse.status()).toBe(201);
  const meeting = (await meetingResponse.json()).meeting as { id: string };
  const completedMeeting = await request.post(`/api/meetings/${meeting.id}/run`, { headers });
  expect((await completedMeeting.json()).meeting.status).toBe('COMPLETED');

  const approval = await request.post('/api/approvals', {
    headers,
    data: {
      approvalType: 'DESIGN',
      subjectType: 'meeting',
      subjectId: meeting.id,
      title: 'Approve architecture direction',
      risk: 'HIGH',
    },
  });
  const approvalId = (await approval.json()).approval.id as string;
  const notifications = await request.get('/api/notifications', { headers });
  expect((await notifications.json()).unread).toBe(1);
  expect(
    (
      await request.patch(`/api/approvals?approvalId=${approvalId}`, {
        headers,
        data: { status: 'APPROVED' },
      })
    ).status(),
  ).toBe(200);

  const cost = await request.post('/api/costs', {
    headers,
    data: { amount: 1.25, provider: 'fake', model: 'test-model' },
  });
  expect(cost.status()).toBe(201);
  expect((await (await request.get('/api/costs', { headers })).json()).entries).toHaveLength(2);

  const repository = await request.post(`/api/projects/${project.id}/repository`, {
    headers,
    data: { providerType: 'GITHUB', owner: 'example', name: 'operations' },
  });
  expect((await repository.json()).repository.status).toBe('REQUIRES_AUTH');
  const push = await request.post('/api/notifications/subscribe', {
    headers,
    data: { endpoint: 'https://push.example.test/subscription', p256dh: 'key', auth: 'auth' },
  });
  expect(push.status()).toBe(201);
});
