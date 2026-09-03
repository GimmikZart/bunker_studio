import { afterEach, describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../../../organizations/route';
import { POST as createProject } from '../../../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../../../agents/route';
import { POST as createWorkflowPlan } from '../route';
import { POST as generatePlan } from './route';

async function studio() {
  const owner = `plan-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
  const organizationId = (
    await (
      await createOrganization(
        new Request('http://localhost', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ name: 'Planning Studio' }),
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
  const leadAgentId = (
    await (
      await createAgent(
        new Request('http://localhost', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'Ada',
            roleKey: 'lead',
            title: 'Lead Architect / Orchestrator',
            providerConnectionId: crypto.randomUUID(),
            providerModelId: 'test-model',
            runtimeType: 'OPENAI',
            skills: ['typescript', 'postgres'],
            tools: [],
            permissions: [],
          }),
        }),
      )
    ).json()
  ).agent.id;
  return { headers, projectId, leadAgentId };
}

function planResponse(tasks: unknown[]) {
  return JSON.stringify({
    goal: 'Ship the billing module.',
    assumptions: ['The schema is stable.'],
    verificationSteps: ['pnpm verify'],
    tasks,
  });
}

const VALID_TASKS = [
  {
    id: 'schema',
    title: 'Define the schema',
    taskType: 'BACKEND',
    description: 'Add the billing tables.',
    dependencies: [],
    readScope: ['docs'],
    writeScope: ['packages/db'],
    definitionOfDone: ['Migration applies cleanly.'],
    verificationCommands: [],
    estimatedCost: 1,
  },
  {
    id: 'api',
    title: 'Expose the API',
    taskType: 'BACKEND',
    description: 'Add the billing routes.',
    dependencies: ['schema'],
    readScope: ['packages/db'],
    writeScope: ['apps/web'],
    definitionOfDone: ['Route tests pass.'],
    verificationCommands: [],
    estimatedCost: 2,
  },
];

afterEach(() => {
  delete process.env.BUNKER_FAKE_RUNTIME_RESPONSE;
});

describe('Lead plan generation route', () => {
  it('returns a validated proposal in dependency order without persisting it', async () => {
    const { headers, projectId, leadAgentId } = await studio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = planResponse(VALID_TASKS);
    const response = await generatePlan(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, leadAgentId, goal: 'Ship billing.' }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.order).toEqual(['schema', 'api']);
    expect(payload.plan.tasks).toHaveLength(2);

    // The proposal is not work until it is submitted separately.
    const { GET: listWorkflows } = await import('../route');
    const listed = await listWorkflows(new Request('http://localhost', { headers }));
    expect((await listed.json()).workflows).toHaveLength(0);
  });

  it('rejects a plan whose frontend task has no approved design', async () => {
    const { headers, projectId, leadAgentId } = await studio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = planResponse([
      {
        ...VALID_TASKS[0],
        id: 'ui',
        taskType: 'FRONTEND',
        dependencies: [],
        writeScope: ['apps/web'],
      },
    ]);
    const response = await generatePlan(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, leadAgentId, goal: 'Ship the screen.' }),
      }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).reasons.join(' ')).toContain('approved design version');
  });

  it('rejects a response that is not a usable plan', async () => {
    const { headers, projectId, leadAgentId } = await studio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = 'I will start by writing the schema.';
    const response = await generatePlan(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, leadAgentId, goal: 'Ship billing.' }),
      }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe('The Lead did not return a usable plan.');
  });

  it('refuses a project from another organization', async () => {
    const { headers, leadAgentId } = await studio();
    const other = await studio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = planResponse(VALID_TASKS);
    const response = await generatePlan(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId: other.projectId, leadAgentId, goal: 'Ship billing.' }),
      }),
    );
    expect(response.status).toBe(404);
  });
});

describe('Lead plan submission gates', () => {
  it('rejects a plan that violates the studio rules even when posted directly', async () => {
    const { headers, projectId } = await studio();
    const response = await createWorkflowPlan(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          plan: {
            goal: 'Sneak past the gate',
            assumptions: [],
            verificationSteps: ['none'],
            tasks: [
              {
                id: 'ui',
                title: 'Build the screen',
                taskType: 'FRONTEND',
                description: '',
                dependencies: [],
                readScope: [],
                writeScope: ['apps/web'],
                definitionOfDone: ['Ships.'],
                estimatedCost: 1,
              },
            ],
          },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).reasons.join(' ')).toContain('approved design version');
  });
});
