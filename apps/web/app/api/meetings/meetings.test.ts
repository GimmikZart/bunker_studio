import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as createProject } from '../organizations/[organizationId]/projects/route';
import { POST as createAgent } from '../agents/route';
import { POST as createMeeting } from './route';
import { POST as runMeeting } from './[meetingId]/run/route';

describe('meeting room API', () => {
  it('runs a bounded architecture meeting and persists minutes, actions, and cost', async () => {
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
    const completed = await runMeeting(
      new Request(`http://localhost/api/meetings/${meetingId}/run`, { method: 'POST', headers }),
      { params: Promise.resolve({ meetingId }) },
    );
    expect(completed.status).toBe(200);
    const meeting = (await completed.json()).meeting;
    expect(meeting.contributions).toHaveLength(6);
    expect(meeting.minutes.decisions).toHaveLength(1);
    expect(meeting.minutes.actionItems).toHaveLength(3);
    expect(meeting.cost).toBe(0.06);
  });
});
