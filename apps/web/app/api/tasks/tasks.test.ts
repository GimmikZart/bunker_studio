import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as createProject } from '../organizations/[organizationId]/projects/route';
import { POST as submitDesign } from '../designs/route';
import { POST as approveDesign } from '../designs/[versionId]/approve/route';
import { PATCH, POST } from './route';
import { POST as createPolicy } from '../budgets/policies/route';
import { GET as listNotifications } from '../notifications/route';
import { POST as createAgent } from '../agents/route';

describe('task design reference policy', () => {
  it('requires and accepts an approved design for frontend tasks', async () => {
    const userId = `frontend-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const organizationResponse = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Frontend Design Gate' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id as string;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Frontend project' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id as string;
    const withoutDesign = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, title: 'Build screen', taskType: 'FRONTEND' }),
      }),
    );
    expect(withoutDesign.status).toBe(409);

    const submitted = await submitDesign(
      new Request('http://localhost/api/designs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          versionNumber: 1,
          status: 'SUBMITTED',
          spec: { screen: 'home' },
          rationale: 'gate test',
          previewArtifactIds: [],
        }),
      }),
    );
    const version = (await submitted.json()).version;
    await approveDesign(
      new Request('http://localhost/api/designs/approve', { method: 'POST', headers }),
      { params: Promise.resolve({ versionId: version.id }) },
    );
    const withDesign = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          title: 'Build approved screen',
          taskType: 'FRONTEND',
          approvedDesignVersionId: version.id,
        }),
      }),
    );
    expect(withDesign.status).toBe(201);
    expect((await withDesign.json()).task.approvedDesignVersionId).toBe(version.id);
  });

  it('blocks queueing when the applicable hard budget is exceeded', async () => {
    const userId = `budget-task-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const organizationResponse = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Task Budget Gate' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id as string;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Budget project' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id as string;
    const agentResponse = await createAgent(
      new Request('http://localhost/api/agents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Budget Builder',
          roleKey: 'backend',
          title: 'Backend Engineer',
          providerConnectionId: '00000000-0000-4000-8000-000000000001',
          providerModelId: 'fake-default',
          runtimeType: 'OPENAI_COMPATIBLE',
          reasoningEffort: 'medium',
        }),
      }),
    );
    const assignedAgentId = (await agentResponse.json()).agent.id as string;
    const policyResponse = await createPolicy(
      new Request('http://localhost/api/budgets/policies', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          periodType: 'PER_TASK',
          softLimit: 4,
          hardLimit: 5,
          currency: 'USD',
          actionOnSoft: 'NOTIFY',
          actionOnHard: 'BLOCK',
          escalationThreshold: 2,
          allowProviderFallback: false,
          enabled: true,
        }),
      }),
    );
    expect(policyResponse.status).toBe(201);
    const softTaskResponse = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          title: 'Soft threshold task',
          taskType: 'BACKEND',
          assignedAgentId,
          estimatedCost: 4.5,
        }),
      }),
    );
    const softTask = (await softTaskResponse.json()).task;
    await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${softTask.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'READY' }),
      }),
    );
    const softQueued = await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${softTask.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'QUEUED' }),
      }),
    );
    expect(softQueued.status).toBe(200);
    const softNotifications = await listNotifications(
      new Request('http://localhost/api/notifications', { headers }),
    );
    expect((await softNotifications.json()).notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'BUDGET', deepLink: `/tasks?taskId=${softTask.id}` }),
      ]),
    );
    const taskResponse = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          title: 'Expensive task',
          taskType: 'BACKEND',
          assignedAgentId,
          estimatedCost: 10,
        }),
      }),
    );
    const task = (await taskResponse.json()).task;
    const ready = await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${task.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'READY' }),
      }),
    );
    expect(ready.status).toBe(200);
    const queued = await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${task.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'QUEUED' }),
      }),
    );
    expect(queued.status).toBe(409);
    const queuedPayload = await queued.json();
    expect(queuedPayload.budget.decision).toBe('HARD_STOP');
    expect(queuedPayload.task.state).toBe('BLOCKED');
    const notifications = await listNotifications(
      new Request('http://localhost/api/notifications', { headers }),
    );
    expect((await notifications.json()).notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'BUDGET', deepLink: `/tasks?taskId=${task.id}` }),
      ]),
    );
  });

  it('requires deterministic verification before queueing a Codex repository task', async () => {
    const userId = `codex-task-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const organizationResponse = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Codex Verification Gate' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id as string;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Codex project' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id as string;
    const agentResponse = await createAgent(
      new Request('http://localhost/api/agents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Codex Builder',
          roleKey: 'backend',
          title: 'Backend Engineer',
          providerConnectionId: '00000000-0000-4000-8000-000000000001',
          providerModelId: 'gpt-test',
          runtimeType: 'CODEX_SDK',
          reasoningEffort: 'high',
        }),
      }),
    );
    expect(agentResponse.status).toBe(201);
    const assignedAgentId = (await agentResponse.json()).agent.id as string;
    const taskResponse = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          title: 'Implement safely',
          taskType: 'BACKEND',
          assignedAgentId,
          writeScope: ['packages/core'],
          verificationCommands: [],
        }),
      }),
    );
    const task = (await taskResponse.json()).task;
    await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${task.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'READY' }),
      }),
    );
    const queued = await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${task.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'QUEUED' }),
      }),
    );
    expect(queued.status).toBe(409);
    await expect(queued.json()).resolves.toMatchObject({
      error: expect.stringContaining('deterministic verification'),
    });
  });
});
