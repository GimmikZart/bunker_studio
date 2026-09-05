import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as readStages } from './route';
import { POST as startSpec } from './spec/route';
import { POST as approveBrief } from '../engagement/approve/route';
import { POST as createOrganization } from '../../../organizations/route';
import { POST as createProject } from '../../../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../../../agents/route';
import { POST as assignAgents } from '../agents/route';
import { POST as connectRepository } from '../repository/route';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

const brief = {
  questions: [],
  understanding: 'Let a guest pay without an account.',
  openPoints: ['Whether to keep the guest email'],
  proposedScope: ['Guest checkout'],
  outOfScope: ['Changing the payment provider'],
  playbookKey: 'feature-on-existing-repo',
  readyForApproval: true,
};

const verification = [
  { kind: 'SECURITY' as const, executable: 'pnpm', args: ['audit'], timeoutMs: 60_000 },
];

async function studio(name: string) {
  const userId = `stage-owner-${crypto.randomUUID()}`;
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
          body: JSON.stringify({ name: 'Vrsus App' }),
        }),
        { params: Promise.resolve({ organizationId }) },
      )
    ).json()
  ).project.id as string;
  const params = { params: Promise.resolve({ projectId }) };

  async function hire(agentName: string, roleKey: string, runtimeType: string) {
    const id = (
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
              runtimeType,
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
        body: JSON.stringify({ agentIds: [id] }),
      }),
      params,
    );
    return id;
  }

  async function attachRepository() {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 5).toString('base64url'));
    globalThis.fetch = vi.fn(
      async (target: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(target).includes('/branches/')
              ? { name: 'main' }
              : { id: 1, default_branch: 'main', permissions: { push: true } },
          ),
          { status: 200 },
        ),
    ) as typeof fetch;
    const response = await connectRepository(
      new Request(`http://localhost/api/projects/${projectId}/repository`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          providerType: 'GITHUB',
          owner: 'GimmikZart',
          name: 'vrsus_website',
          defaultBranch: 'main',
          accessToken: 'github_pat_example',
        }),
      }),
      params,
    );
    globalThis.fetch = originalFetch;
    return response.status;
  }

  return {
    headers,
    projectId,
    hire,
    attachRepository,
    approve: () =>
      approveBrief(
        new Request(`http://localhost/api/projects/${projectId}/engagement/approve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ brief }),
        }),
        params,
      ),
    stages: async () =>
      (await readStages(new Request('http://localhost', { headers }), params)).json(),
    spec: (body: unknown = { verificationCommands: verification }) =>
      startSpec(
        new Request(`http://localhost/api/projects/${projectId}/stages/spec`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }),
        params,
      ),
  };
}

describe('where a project is in its way of working', () => {
  it('starts on discovery and names what closes it', async () => {
    const context = await studio('Fresh Studio');
    const payload = await context.stages();
    expect(payload.briefApproved).toBe(false);
    expect(payload.current.key).toBe('discovery');
    expect(payload.current.waitingFor).toContain('approve it');
  });

  it('moves to the specification once the brief is approved', async () => {
    const context = await studio('Approved Studio');
    await context.approve();
    const payload = await context.stages();
    expect(payload.briefApproved).toBe(true);
    expect(payload.current.key).toBe('spec');
    expect(payload.playbook.key).toBe('feature-on-existing-repo');
  });
});

describe('writing the specification', () => {
  it('refuses before a brief has been approved', async () => {
    const context = await studio('No Brief Studio');
    const response = await context.spec();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('Talk to the Lead');
  });

  it('refuses without a security check, rather than inventing one', async () => {
    const context = await studio('No Security Studio');
    await context.approve();
    const response = await context.spec({
      verificationCommands: [
        { kind: 'LINT', executable: 'pnpm', args: ['lint'], timeoutMs: 60_000 },
      ],
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('security check');
  });

  it('refuses while no repository is connected, since that is where it goes', async () => {
    const context = await studio('No Repository Studio');
    await context.approve();
    const response = await context.spec();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('Connect a GitHub repository');
  });

  it('refuses when nobody on the project can reach the repository', async () => {
    const context = await studio('No Writer Studio');
    await context.approve();
    expect(await context.attachRepository()).toBe(201);
    // An API-runtime agent would produce the text of a document and leave the
    // repository untouched, so the task is not created at all.
    await context.hire('Pollastro', 'lead', 'OPENAI_COMPATIBLE');
    const response = await context.spec();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('reach the repository');
  });

  it('creates the task, assigns it to a writer and carries the brief into it', async () => {
    const context = await studio('Writing Studio');
    await context.approve();
    expect(await context.attachRepository()).toBe(201);
    const writer = await context.hire('Pollastro', 'lead', 'CODEX_SDK');

    const response = await context.spec();
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.path).toBe('docs/specs/vrsus-app.md');
    expect(payload.task.assignedAgentId).toBe(writer);
    expect(payload.task.writeScope).toEqual(['docs']);
    // What was excluded travels with the task; it is the part a plan grows back.
    expect(payload.task.description).toContain('Changing the payment provider');
    expect(payload.task.description).toContain('Whether to keep the guest email');

    const stages = await context.stages();
    expect(stages.current.key).toBe('spec');
    expect(stages.current.waitingFor).toContain('specification is');
  });

  it('does not start a second specification', async () => {
    const context = await studio('Twice Studio');
    await context.approve();
    await context.attachRepository();
    await context.hire('Pollastro', 'lead', 'CODEX_SDK');
    expect((await context.spec()).status).toBe(201);
    const again = await context.spec();
    expect(again.status).toBe(409);
    expect((await again.json()).error).toContain('already being written');
  });
});
