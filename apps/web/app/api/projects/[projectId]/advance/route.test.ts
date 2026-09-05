import { describe, expect, it } from 'vitest';
import { POST as advance } from './route';
import { POST as createOrganization } from '../../../organizations/route';
import { POST as createProject } from '../../../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../../../agents/route';
import { POST as assignAgents } from '../agents/route';
import { POST as commitPlan } from '../../../workflows/plan/route';
import { GET as listTasks } from '../../../tasks/route';

async function studio(name: string) {
  const userId = `conductor-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
  const organizationId = (
    await (
      await createOrganization(
        new Request('http://localhost/api/organizations', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ name }),
        }),
      )
    ).json()
  ).organization.id as string;
  const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
  const projectId = (
    await (
      await createProject(
        new Request(`http://localhost/api/organizations/${organizationId}/projects`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: 'Delivery' }),
        }),
        { params: Promise.resolve({ organizationId }) },
      )
    ).json()
  ).project.id as string;

  async function hire(agentName: string, roleKey: string) {
    const created = (
      await (
        await createAgent(
          new Request('http://localhost/api/agents', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: agentName,
              roleKey,
              title: `${agentName} title`,
              skills: [roleKey],
              providerConnectionId: '00000000-0000-4000-8000-000000000001',
              providerModelId: 'fake-default',
              runtimeType: 'OPENAI_COMPATIBLE',
              reasoningEffort: 'medium',
            }),
          }),
        )
      ).json()
    ).agent.id as string;
    await assignAgents(
      new Request(`http://localhost/api/projects/${projectId}/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ agentIds: [created] }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    return created;
  }

  async function tasks() {
    const response = await listTasks(new Request('http://localhost/api/tasks', { headers }));
    return ((await response.json()).tasks as { title: string; state: string }[]).filter(Boolean);
  }

  return { headers, organizationId, projectId, hire, tasks };
}

const twoStepPlan = {
  goal: 'Ship the endpoint',
  assumptions: [],
  verificationSteps: ['Run tests.'],
  tasks: [
    {
      id: 'build',
      title: 'Build the endpoint',
      taskType: 'BACKEND',
      description: 'Add the endpoint.',
      dependencies: [],
      readScope: [],
      writeScope: ['packages/service'],
      definitionOfDone: ['Tests pass.'],
      estimatedCost: 1,
    },
    {
      id: 'check',
      title: 'Review the endpoint',
      taskType: 'REVIEW',
      description: 'Review the branch.',
      dependencies: ['build'],
      readScope: ['packages/service'],
      writeScope: [],
      definitionOfDone: ['Findings recorded.'],
      estimatedCost: 1,
    },
  ],
};

describe('the conductor', () => {
  it('starts a committed plan without anyone asking, and parks what waits', async () => {
    const context = await studio('Conductor Studio');
    await context.hire('Bea', 'backend');
    await context.hire('Kenji', 'reviewer');

    const response = await commitPlan(
      new Request('http://localhost/api/workflows/plan', {
        method: 'POST',
        headers: context.headers,
        body: JSON.stringify({ projectId: context.projectId, plan: twoStepPlan }),
      }),
    );
    expect(response.status).toBe(201);

    const states = Object.fromEntries(
      (await context.tasks()).map((task) => [task.title, task.state]),
    );
    expect(states).toEqual({
      'Build the endpoint': 'QUEUED',
      'Review the endpoint': 'WAITING_DEPENDENCY',
    });
  });

  it('blocks what nobody can do, naming what is missing', async () => {
    const context = await studio('Understaffed Studio');
    await context.hire('Bea', 'backend');

    await commitPlan(
      new Request('http://localhost/api/workflows/plan', {
        method: 'POST',
        headers: context.headers,
        body: JSON.stringify({ projectId: context.projectId, plan: twoStepPlan }),
      }),
    );

    const states = Object.fromEntries(
      (await context.tasks()).map((task) => [task.title, task.state]),
    );
    expect(states['Build the endpoint']).toBe('QUEUED');
    // The review waits on its dependency first; that is the honest reason today.
    expect(states['Review the endpoint']).toBe('WAITING_DEPENDENCY');
  });

  it('picks the work up again when the missing role finally joins', async () => {
    const context = await studio('Late Reviewer Studio');
    await context.hire('Bea', 'backend');
    await commitPlan(
      new Request('http://localhost/api/workflows/plan', {
        method: 'POST',
        headers: context.headers,
        body: JSON.stringify({
          projectId: context.projectId,
          plan: {
            ...twoStepPlan,
            tasks: [{ ...twoStepPlan.tasks[1]!, dependencies: [] }],
          },
        }),
      }),
    );
    // With no reviewer on the project the review cannot start, and says so.
    expect((await context.tasks())[0]!.state).toBe('BLOCKED');

    await context.hire('Kenji', 'reviewer');
    expect((await context.tasks())[0]!.state).toBe('QUEUED');
  });

  it('is idempotent: advancing twice changes nothing the second time', async () => {
    const context = await studio('Idempotent Studio');
    await context.hire('Bea', 'backend');
    await context.hire('Kenji', 'reviewer');
    await commitPlan(
      new Request('http://localhost/api/workflows/plan', {
        method: 'POST',
        headers: context.headers,
        body: JSON.stringify({ projectId: context.projectId, plan: twoStepPlan }),
      }),
    );

    const again = await advance(
      new Request(`http://localhost/api/projects/${context.projectId}/advance`, {
        method: 'POST',
        headers: context.headers,
      }),
      { params: Promise.resolve({ projectId: context.projectId }) },
    );
    expect(again.status).toBe(200);
    expect((await again.json()).moves).toEqual([]);
  });

  it('refuses a project of another organization', async () => {
    const owner = await studio('Owner Studio');
    const stranger = await studio('Stranger Studio');
    const response = await advance(
      new Request(`http://localhost/api/projects/${owner.projectId}/advance`, {
        method: 'POST',
        headers: stranger.headers,
      }),
      { params: Promise.resolve({ projectId: owner.projectId }) },
    );
    expect(response.status).toBe(404);
  });
});
