import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../../organizations/route';
import { POST as createProject } from '../../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../../agents/route';
import { POST as createTask } from '../../tasks/route';
import { POST as generateReview } from './route';

async function studio() {
  const owner = `review-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
  const organizationId = (
    await (
      await createOrganization(
        new Request('http://localhost', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ name: 'Review Studio' }),
        }),
      )
    ).json()
  ).organization.id;
  const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
  const projectId = (
    await (
      await createProject(
        new Request('http://localhost', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: 'Delivery' }),
        }),
        { params: Promise.resolve({ organizationId }) },
      )
    ).json()
  ).project.id;
  const reviewerAgentId = (
    await (
      await createAgent(
        new Request('http://localhost', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'Ines',
            roleKey: 'reviewer',
            title: 'Reviewer / QA / Security',
            providerConnectionId: '00000000-0000-4000-8000-000000000003',
            providerModelId: 'fake-default',
            runtimeType: 'OPENAI_COMPATIBLE',
          }),
        }),
      )
    ).json()
  ).agent.id;
  const taskId = (
    await (
      await createTask(
        new Request('http://localhost', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            projectId,
            title: 'Add billing routes',
            description: 'Expose the billing API.',
            taskType: 'BACKEND',
            writeScope: ['apps/web'],
          }),
        }),
      )
    ).json()
  ).task.id;
  return { headers, organizationId, projectId, reviewerAgentId, taskId };
}

function call(headers: Record<string, string>, body: Record<string, unknown>) {
  return generateReview(
    new Request('http://localhost', { method: 'POST', headers, body: JSON.stringify(body) }),
  );
}

describe('review generation route', () => {
  it('refuses a task that has no published candidate', async () => {
    const { headers, projectId, taskId, reviewerAgentId } = await studio();
    const response = await call(headers, { projectId, taskId, reviewerAgentId });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('The task has no published candidate to review.');
  });

  it('refuses a task from another project', async () => {
    const { headers, taskId, reviewerAgentId } = await studio();
    const other = await studio();
    const response = await call(headers, {
      projectId: other.projectId,
      taskId,
      reviewerAgentId,
    });
    expect(response.status).toBe(404);
  });

  it('refuses a caller outside the organization', async () => {
    const { headers, projectId, taskId, reviewerAgentId } = await studio();
    const response = await call(
      { ...headers, 'x-bunker-user-id': `intruder-${crypto.randomUUID()}` },
      { projectId, taskId, reviewerAgentId },
    );
    expect(response.status).toBe(403);
  });

  it('requires authentication and an organization', async () => {
    const response = await generateReview(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('rejects a malformed request body', async () => {
    const { headers } = await studio();
    const response = await call(headers, { projectId: 'not-a-uuid' });
    expect(response.status).toBe(400);
  });
});
