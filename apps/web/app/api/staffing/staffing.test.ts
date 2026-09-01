import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as confirmStaffing } from './confirm/route';
import { POST as proposeStaffing } from './proposals/route';
import { tenantStore } from '../_store';

describe('staffing API', () => {
  it('does not persist recommendations before explicit confirmation', async () => {
    const owner = `hr-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organization = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `HR ${owner}` }),
      }),
    );
    const organizationId = (await organization.json()).organization.id;
    const proposalResponse = await proposeStaffing(
      new Request('http://localhost', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({
          goal: 'Ship an accessible frontend flow',
          requiredRoles: ['frontend'],
          capabilities: ['accessibility'],
          budget: 2,
        }),
      }),
    );
    expect((await proposalResponse.json()).proposals).toHaveLength(1);
    expect(
      tenantStore.snapshot().agents.filter((agent) => agent.organizationId === organizationId),
    ).toHaveLength(0);
    const confirmation = await confirmStaffing(
      new Request('http://localhost', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({
          confirmed: true,
          agents: [
            {
              name: 'Frontend',
              roleKey: 'frontend',
              title: 'Frontend Engineer',
              personality: {},
              providerConnectionId: '00000000-0000-4000-8000-000000000001',
              providerModelId: 'fake-default',
              runtimeType: 'OPENAI_COMPATIBLE',
              reasoningEffort: 'medium',
            },
          ],
        }),
      }),
    );
    expect(confirmation.status).toBe(201);
    expect(
      tenantStore.snapshot().agents.filter((agent) => agent.organizationId === organizationId),
    ).toHaveLength(1);
  });
});
