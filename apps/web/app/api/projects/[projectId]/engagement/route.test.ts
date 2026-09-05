import { afterEach, describe, expect, it } from 'vitest';
import { GET as readEngagement, POST as speak } from './route';
import { POST as approve } from './approve/route';
import { POST as createOrganization } from '../../../organizations/route';
import { POST as createProject } from '../../../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../../../agents/route';
import { POST as assignAgents } from '../agents/route';

afterEach(() => {
  delete process.env.BUNKER_FAKE_RUNTIME_RESPONSE;
});

const readyBrief = {
  questions: [],
  understanding: 'Rebuild the checkout so a guest can pay without an account.',
  openPoints: [],
  proposedScope: ['Guest checkout', 'Order confirmation email'],
  outOfScope: ['Changing the payment provider'],
  playbookKey: 'feature-on-existing-repo',
  readyForApproval: true,
};

async function studio(name: string) {
  const userId = `engagement-owner-${crypto.randomUUID()}`;
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

  async function hire(agentName: string, roleKey: string) {
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
        body: JSON.stringify({ agentIds: [id] }),
      }),
      { params: Promise.resolve({ projectId }) },
    );
    return id;
  }

  const params = { params: Promise.resolve({ projectId }) };
  return {
    headers,
    projectId,
    hire,
    say: (content: string) =>
      speak(
        new Request(`http://localhost/api/projects/${projectId}/engagement`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content }),
        }),
        params,
      ),
    read: () =>
      readEngagement(
        new Request(`http://localhost/api/projects/${projectId}/engagement`, { headers }),
        params,
      ),
    approveBrief: (brief: unknown) =>
      approve(
        new Request(`http://localhost/api/projects/${projectId}/engagement/approve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ brief }),
        }),
        params,
      ),
  };
}

describe('talking to the Lead about a project', () => {
  it('refuses when the project has no Lead, and says what to do', async () => {
    const context = await studio('No Lead Studio');
    await context.hire('Bea', 'backend');
    const response = await context.say('I want a guest checkout.');
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('role is lead');
  });

  it('answers with a structured brief and picks a way of working', async () => {
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify(readyBrief);
    const context = await studio('Brief Studio');
    await context.hire('Pollastro', 'lead');

    const response = await context.say('I want guests to pay without an account.');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.brief.understanding).toContain('guest');
    expect(payload.brief.readyForApproval).toBe(true);
    expect(payload.playbook.key).toBe('feature-on-existing-repo');
    // The stages that cannot run yet are named now, not when the studio reaches
    // one and stops.
    expect(payload.playbook.unavailable.map((entry: { stage: string }) => entry.stage)).toEqual([
      'Design what needs designing',
    ]);
  });

  it('keeps the conversation, so it can be reopened', async () => {
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify(readyBrief);
    const context = await studio('History Studio');
    await context.hire('Pollastro', 'lead');
    await context.say('I want guest checkout.');

    const payload = await (await context.read()).json();
    expect(payload.turns.map((turn: { role: string }) => turn.role)).toEqual(['USER', 'LEAD']);
    expect(payload.turns[0].content).toBe('I want guest checkout.');
    expect(payload.approvedBrief).toBeNull();
  });

  it('will not call a brief ready while the Lead still has questions', async () => {
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify({
      ...readyBrief,
      questions: ['Which payment provider are you on?'],
      readyForApproval: true,
    });
    const context = await studio('Questions Studio');
    await context.hire('Pollastro', 'lead');
    const payload = await (await context.say('Make checkout better.')).json();
    expect(payload.brief.readyForApproval).toBe(false);
    expect(payload.brief.questions).toHaveLength(1);
  });

  it('reports a Lead that answers with prose instead of a brief', async () => {
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = 'Sure, I think we should start with the cart.';
    const context = await studio('Prose Studio');
    await context.hire('Pollastro', 'lead');
    const response = await context.say('Where do we start?');
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain('structured brief');
  });

  it('approves a brief and keeps it as pinned project memory', async () => {
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify(readyBrief);
    const context = await studio('Approval Studio');
    await context.hire('Pollastro', 'lead');
    await context.say('I want guest checkout.');

    const approved = await context.approveBrief(readyBrief);
    expect(approved.status).toBe(201);
    expect((await approved.json()).playbook.key).toBe('feature-on-existing-repo');

    const payload = await (await context.read()).json();
    expect(payload.approvedBrief.understanding).toBe(readyBrief.understanding);
  });

  it('refuses to approve a brief with open questions in it', async () => {
    const context = await studio('Premature Studio');
    await context.hire('Pollastro', 'lead');
    const response = await context.approveBrief({
      ...readyBrief,
      questions: ['Which provider?'],
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('open questions');
  });

  it('refuses a way of working the studio does not have', async () => {
    const context = await studio('Unknown Playbook Studio');
    await context.hire('Pollastro', 'lead');
    const response = await context.approveBrief({ ...readyBrief, playbookKey: 'freestyle' });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('freestyle');
  });
});
