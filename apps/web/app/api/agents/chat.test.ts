import { describe, expect, it } from 'vitest';
import { POST as createAgent } from './route';
import { POST as chat } from './[agentId]/chat/route';
import { POST as createOrganization } from '../organizations/route';
import { POST as createPolicy } from '../budgets/policies/route';
import { GET as listCosts } from '../costs/route';
import { GET as listNotifications } from '../notifications/route';
import { GET as listConversations } from '../conversations/route';

async function setup() {
  const userId = `chat-owner-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
  const organizationResponse = await createOrganization(
    new Request('http://localhost/api/organizations', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ name: 'Chat Budget' }),
    }),
  );
  const organizationId = (await organizationResponse.json()).organization.id as string;
  const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
  const agentResponse = await createAgent(
    new Request('http://localhost/api/agents', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Chat Agent',
        roleKey: 'assistant',
        title: 'Chat Assistant',
        providerBindingId: 'local-fake',
      }),
    }),
  );
  return {
    userId,
    organizationId,
    headers,
    agentId: (await agentResponse.json()).agent.id as string,
  };
}

function chatRequest(headers: Record<string, string>, agentId: string) {
  return chat(
    new Request(`http://localhost/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: 'Explain the current architecture.' }),
    }),
    { params: Promise.resolve({ agentId }) },
  );
}

describe('direct chat budget gate', () => {
  it('does not invoke or persist a provider run when the hard budget blocks chat', async () => {
    const { headers, agentId } = await setup();
    const policyResponse = await createPolicy(
      new Request('http://localhost/api/budgets/policies', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agentId,
          periodType: 'PER_RUN',
          softLimit: 0,
          hardLimit: 0.005,
          currency: 'USD',
          actionOnSoft: 'NOTIFY',
          actionOnHard: 'BLOCK',
          escalationThreshold: 2,
          allowProviderFallback: false,
          enabled: true,
        }),
      }),
    );
    expect(policyResponse.status).toBe(201);

    const response = await chatRequest(headers, agentId);
    expect(response.status).toBe(409);
    expect((await response.json()).budget.decision).toBe('HARD_STOP');

    const costs = await listCosts(new Request('http://localhost/api/costs', { headers }));
    expect((await costs.json()).entries).toEqual([]);
    const conversations = await listConversations(
      new Request('http://localhost/api/conversations', { headers }),
    );
    expect((await conversations.json()).conversations).toEqual([]);
    const notifications = await listNotifications(
      new Request('http://localhost/api/notifications', { headers }),
    );
    expect((await notifications.json()).notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'BUDGET', severity: 'CRITICAL' }),
      ]),
    );
  });

  it('records successful chat usage in the tenant cost ledger', async () => {
    const { headers, agentId } = await setup();
    const response = await chatRequest(headers, agentId);
    expect(response.status).toBe(200);

    const costs = await listCosts(new Request('http://localhost/api/costs', { headers }));
    const entries = (await costs.json()).entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      amount: 0.01,
      agentId,
      provider: 'fake',
      model: 'local-fake',
    });
    expect(entries[0].runId).toEqual(expect.any(String));
    expect(entries[0].inputTokens).toEqual(expect.any(Number));
    expect(entries[0].outputTokens).toEqual(expect.any(Number));
  });
});
