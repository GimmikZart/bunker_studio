import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as createProject } from '../organizations/[organizationId]/projects/route';
import { POST as submitDesign } from '../designs/route';
import { POST as approveDesign } from '../designs/[versionId]/approve/route';
import { PATCH, POST } from './route';
import { POST as createPolicy } from '../budgets/policies/route';
import { GET as listNotifications } from '../notifications/route';
import { POST as createAgent } from '../agents/route';
import { POST as addVerification } from './[taskId]/verification/route';
import { POST as submitReview } from '../reviews/route';

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

    const noSecurityResponse = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          title: 'Implement without security scan',
          taskType: 'BACKEND',
          assignedAgentId,
          writeScope: ['packages/core'],
          verificationCommands: [
            { kind: 'UNIT', executable: 'pnpm', args: ['test'], timeoutMs: 300_000 },
          ],
        }),
      }),
    );
    const noSecurityTask = (await noSecurityResponse.json()).task;
    await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${noSecurityTask.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'READY' }),
      }),
    );
    const noSecurityQueued = await PATCH(
      new Request(`http://localhost/api/tasks?taskId=${noSecurityTask.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'QUEUED' }),
      }),
    );
    expect(noSecurityQueued.status).toBe(409);
    await expect(noSecurityQueued.json()).resolves.toMatchObject({
      error: expect.stringContaining('baseline security'),
    });
  });

  it('blocks completion until deterministic verification and reviewer gates pass', async () => {
    const userId = `review-gate-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const organizationResponse = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Review Completion Gate' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id as string;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Review project' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id as string;
    const createConfiguredAgent = async (name: string, roleKey: string) => {
      const response = await createAgent(
        new Request('http://localhost/api/agents', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name,
            roleKey,
            title: roleKey === 'reviewer' ? 'Reviewer' : 'Engineer',
            providerConnectionId: '00000000-0000-4000-8000-000000000001',
            providerModelId: 'fake-default',
            runtimeType: 'OPENAI_COMPATIBLE',
            reasoningEffort: 'medium',
          }),
        }),
      );
      return (await response.json()).agent.id as string;
    };
    const assignedAgentId = await createConfiguredAgent('Builder', 'backend');
    const reviewerAgentId = await createConfiguredAgent('Reviewer', 'reviewer');
    const taskResponse = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          title: 'Gated task',
          taskType: 'BACKEND',
          assignedAgentId,
        }),
      }),
    );
    const task = (await taskResponse.json()).task;
    const move = (state: string) =>
      PATCH(
        new Request(`http://localhost/api/tasks?taskId=${task.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ state }),
        }),
      );
    for (const state of ['READY', 'QUEUED', 'RUNNING', 'IMPLEMENTED', 'VERIFYING'])
      expect((await move(state)).status).toBe(200);
    expect((await move('REVIEW_PENDING')).status).toBe(409);
    const verification = await addVerification(
      new Request('http://localhost/api/tasks/task/verification', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kind: 'UNIT',
          commandOrCheck: 'deterministic test',
          status: 'PASS',
          durationMs: 10,
        }),
      }),
      { params: Promise.resolve({ taskId: task.id }) },
    );
    expect(verification.status).toBe(201);
    expect((await move('REVIEW_PENDING')).status).toBe(200);
    expect((await move('DONE')).status).toBe(409);
    const review = await submitReview(
      new Request('http://localhost/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          taskId: task.id,
          reviewerAgentId,
          report: {
            candidateSha: 'manual-candidate',
            status: 'PASS',
            summary: 'No blocking findings.',
            findings: [],
            verificationRuns: [],
          },
        }),
      }),
    );
    expect(review.status).toBe(201);
    expect((await move('DONE')).status).toBe(200);
  });
});
