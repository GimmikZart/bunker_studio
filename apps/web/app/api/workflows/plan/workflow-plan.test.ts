import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../../organizations/route';
import { POST as createProject } from '../../organizations/[organizationId]/projects/route';
import { GET as listWorkflows, POST as createWorkflowPlan } from './route';

describe('Lead workflow plan route', () => {
  it('validates and persists a structured plan with remapped task dependencies', async () => {
    const owner = `lead-owner-${crypto.randomUUID()}`;
    const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationResponse = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({ name: 'Lead Workspace' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id;
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers: { ...baseHeaders, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({ name: 'Delivery' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id;
    const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
    const response = await createWorkflowPlan(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          plan: {
            goal: 'Ship the service',
            assumptions: ['The repository is available.'],
            verificationSteps: ['Run typecheck.', 'Run integration tests.'],
            tasks: [
              {
                id: 'implementation',
                title: 'Implement service',
                taskType: 'BACKEND',
                description: 'Build the service boundary.',
                dependencies: ['schema'],
                readScope: ['docs'],
                writeScope: ['packages/service'],
                definitionOfDone: ['API contract is covered.'],
                estimatedCost: 2,
              },
              {
                id: 'schema',
                title: 'Define schema',
                taskType: 'BACKEND',
                description: 'Define the durable schema.',
                dependencies: [],
                readScope: [],
                writeScope: ['packages/schema'],
                definitionOfDone: ['Schema tests pass.'],
                estimatedCost: 1,
              },
            ],
          },
        }),
      }),
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.workflow).toMatchObject({
      projectId,
      goal: 'Ship the service',
      assumptions: ['The repository is available.'],
      verificationSteps: ['Run typecheck.', 'Run integration tests.'],
    });
    expect(payload.tasks).toHaveLength(2);
    expect(payload.tasks[0].workflowId).toBe(payload.workflow.id);
    expect(payload.tasks[0].definitionOfDone).toEqual(['Schema tests pass.']);
    expect(payload.tasks[0].title).toBe('Define schema');
    expect(payload.tasks[1].dependencies).toEqual([payload.tasks[0].id]);
    expect(payload.workflow.taskIds).toEqual(payload.tasks.map((task: { id: string }) => task.id));

    const listed = await listWorkflows(new Request('http://localhost', { headers }));
    expect((await listed.json()).workflows).toHaveLength(1);
  });

  it('rejects cyclic plans before creating a workflow', async () => {
    const owner = `lead-cycle-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organizationResponse = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Cycle Workspace' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id;
    const projectResponse = await createProject(
      new Request('http://localhost', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({ name: 'Cycle Project' }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );
    const projectId = (await projectResponse.json()).project.id;
    const response = await createWorkflowPlan(
      new Request('http://localhost', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({
          projectId,
          plan: {
            goal: 'Reject cycle',
            assumptions: [],
            verificationSteps: ['Test'],
            tasks: [
              {
                id: 'a',
                title: 'A',
                taskType: 'TEST',
                description: '',
                dependencies: ['b'],
                readScope: [],
                writeScope: [],
                definitionOfDone: ['Pass'],
                estimatedCost: 0,
              },
              {
                id: 'b',
                title: 'B',
                taskType: 'TEST',
                description: '',
                dependencies: ['a'],
                readScope: [],
                writeScope: [],
                definitionOfDone: ['Pass'],
                estimatedCost: 0,
              },
            ],
          },
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
