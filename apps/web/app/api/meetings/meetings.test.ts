import { afterEach, describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as createProject } from '../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../agents/route';
import { POST as createMeeting } from './route';
import { POST as runMeeting } from './[meetingId]/run/route';

afterEach(() => {
  delete process.env.BUNKER_FAKE_RUNTIME_RESPONSE;
});

async function architectureMeeting() {
  const owner = `meeting-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
  const organization = await createOrganization(
    new Request('http://localhost', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ name: `Meetings ${owner}` }),
    }),
  );
  const organizationId = (await organization.json()).organization.id as string;
  const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
  const project = await createProject(
    new Request('http://localhost', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Architecture project' }),
    }),
    { params: Promise.resolve({ organizationId }) },
  );
  const projectId = (await project.json()).project.id as string;
  const agentIds = await Promise.all(
    ['Lead', 'Backend', 'Reviewer'].map(async (name) => {
      const response = await createAgent(
        new Request('http://localhost', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name,
            roleKey: name.toLowerCase(),
            title: name,
            providerConnectionId: '00000000-0000-4000-8000-000000000001',
            providerModelId: 'fake-default',
            runtimeType: 'OPENAI_COMPATIBLE',
            reasoningEffort: 'medium',
          }),
        }),
      );
      return (await response.json()).agent.id as string;
    }),
  );
  const created = await createMeeting(
    new Request('http://localhost/api/meetings', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId,
        title: 'Architecture review',
        meetingType: 'ARCHITECTURE',
        agenda: ['Choose data boundary'],
        agentIds,
        maxRounds: 2,
      }),
    }),
  );
  expect(created.status).toBe(201);
  const meetingId = (await created.json()).meeting.id as string;
  return { headers, meetingId, agentIds };
}

async function run(headers: Record<string, string>, meetingId: string) {
  const completed = await runMeeting(
    new Request(`http://localhost/api/meetings/${meetingId}/run`, { method: 'POST', headers }),
    { params: Promise.resolve({ meetingId }) },
  );
  expect(completed.status).toBe(200);
  return (await completed.json()).meeting;
}

describe('meeting room API', () => {
  it('collects a contribution per participant per round and charges every turn', async () => {
    const { headers, meetingId } = await architectureMeeting();
    const meeting = await run(headers, meetingId);
    // Three participants over two rounds, plus the Lead drafting the minutes.
    expect(meeting.contributions).toHaveLength(6);
    expect(meeting.cost).toBe(0.07);
    expect(meeting.contributions[0].content).toContain('Architecture review');
  });

  it('records the decisions the Lead actually drafted', async () => {
    const { headers, meetingId, agentIds } = await architectureMeeting();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify({
      summary: 'The team chose a single data boundary.',
      decisions: [{ title: 'Data boundary', decision: 'One service owns billing writes.' }],
      actionItems: [{ title: 'Draft the migration', ownerAgentId: agentIds[1] }],
    });
    const meeting = await run(headers, meetingId);
    expect(meeting.minutes.summary).toBe('The team chose a single data boundary.');
    expect(meeting.minutes.decisions).toHaveLength(1);
    expect(meeting.minutes.actionItems[0].ownerAgentId).toBe(agentIds[1]);
  });

  it('records no decisions when the Lead cannot draft usable minutes', async () => {
    const { headers, meetingId } = await architectureMeeting();
    const meeting = await run(headers, meetingId);
    // The default fake runtime answers in prose, so nothing can be proven.
    expect(meeting.minutes.decisions).toEqual([]);
    expect(meeting.minutes.actionItems).toEqual([]);
    expect(meeting.minutes.summary.length).toBeGreaterThan(0);
  });

  it('refuses an action item assigned to someone who did not attend', async () => {
    const { headers, meetingId } = await architectureMeeting();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify({
      summary: 'Discussed the boundary.',
      decisions: [],
      actionItems: [{ title: 'Do the work', ownerAgentId: '99999999-9999-4999-8999-999999999999' }],
    });
    const meeting = await run(headers, meetingId);
    expect(meeting.minutes.actionItems).toEqual([]);
  });
});
