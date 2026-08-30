import { describe, expect, it } from 'vitest';
import { POST as createAgent } from '../agents/route';
import { POST as createTask } from '../tasks/route';
import { POST as createOrganization } from '../organizations/route';
import { POST as createProject } from '../organizations/[organizationId]/projects/route';
import { POST, GET } from './route';
import {
  POST as addVerification,
  GET as listVerification,
} from '../tasks/[taskId]/verification/route';

describe('verification and review routes', () => {
  it('persists checks and creates deterministic fix tasks for blocking findings', async () => {
    const owner = `review-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organization = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Review Studio' }),
      }),
    );
    const organizationId = (await organization.json()).organization.id;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Review API' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id;
    const agentResponse = await createAgent(
      new Request('http://localhost/api/agents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Reviewer',
          roleKey: 'reviewer',
          title: 'QA Reviewer',
          providerBindingId: 'local-fake',
        }),
      }),
    );
    const reviewerAgentId = (await agentResponse.json()).agent.id;
    const taskResponse = await createTask(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          title: 'Implement endpoint',
          taskType: 'BACKEND',
          writeScope: ['apps/web/app/api/reviews'],
        }),
      }),
    );
    const taskId = (await taskResponse.json()).task.id;

    const verification = await addVerification(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kind: 'TYPECHECK',
          commandOrCheck: 'pnpm typecheck',
          status: 'PASS',
          durationMs: 120,
        }),
      }),
      { params: Promise.resolve({ taskId }) },
    );
    expect(verification.status).toBe(201);
    const checks = await listVerification(new Request('http://localhost', { headers }), {
      params: Promise.resolve({ taskId }),
    });
    expect((await checks.json()).verificationRuns).toHaveLength(1);

    const review = await POST(
      new Request('http://localhost/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          taskId,
          reviewerAgentId,
          report: {
            candidateSha: 'abc123',
            status: 'FIX_REQUIRED',
            summary: 'One issue remains.',
            findings: [
              {
                severity: 'HIGH',
                category: 'CORRECTNESS',
                title: 'Missing validation',
                description: 'The request is not validated.',
                evidence: 'Observed in route.',
                filePath: 'apps/web/app/api/reviews/route.ts',
                recommendation: 'Parse the request with the contract.',
                blocking: true,
                confidence: 0.95,
              },
            ],
            verificationRuns: [
              {
                kind: 'SECURITY',
                commandOrCheck: 'pnpm audit --audit-level high',
                status: 'PASS',
                artifactId: crypto.randomUUID(),
                durationMs: 80,
              },
            ],
          },
        }),
      }),
    );
    expect(review.status).toBe(201);
    const reviewPayload = await review.json();
    expect(reviewPayload.verificationRuns).toHaveLength(1);
    expect(reviewPayload.fixTasks).toHaveLength(1);

    const reviews = await GET(new Request('http://localhost', { headers }));
    expect((await reviews.json()).reviews).toHaveLength(1);
  });

  it('rejects a report whose status bypasses the review policy', async () => {
    const response = await POST(
      new Request('http://localhost/api/reviews', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bunker-user-id': `review-intruder-${crypto.randomUUID()}`,
          'x-bunker-organization-id': crypto.randomUUID(),
        },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(403);
  });
});
