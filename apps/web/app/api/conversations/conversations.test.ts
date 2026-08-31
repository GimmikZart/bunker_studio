import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { recordConversation } from '../_store';
import { GET } from './route';

describe('conversation archive route', () => {
  it('searches only the selected tenant and returns newest matches first', async () => {
    const userId = `conversation-owner-${crypto.randomUUID()}`;
    const headers = { 'x-bunker-user-id': userId };
    const organizationResponse = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Conversation archive' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id as string;
    recordConversation({
      organizationId,
      agentId: 'agent-a',
      externalSessionId: 'session-older',
      messages: ['unrelated note', 'older result'],
    });
    recordConversation({
      organizationId,
      agentId: 'agent-a',
      externalSessionId: 'session-newer',
      messages: ['searchable deployment decision', 'assistant response'],
    });

    const response = await GET(
      new Request(`http://localhost/api/conversations?q=deployment&limit=1`, {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.conversations).toHaveLength(1);
    expect(payload.conversations[0].externalSessionId).toBe('session-newer');
  });

  it('rejects requests without tenant authentication', async () => {
    const response = await GET(new Request('http://localhost/api/conversations'));
    expect(response.status).toBe(401);
  });
});
