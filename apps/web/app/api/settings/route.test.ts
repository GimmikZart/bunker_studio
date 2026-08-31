import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { GET } from './route';
import { configuredRuntimeProvider } from './runtime-provider';

describe('configuredRuntimeProvider', () => {
  it('describes the configured runtime without exposing its API key', () => {
    const provider = configuredRuntimeProvider({
      AGENT_PROVIDER_TYPE: 'openai',
      AGENT_PROVIDER_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
      AGENT_PROVIDER_MODEL: 'test-model',
    });

    expect(provider).toMatchObject({
      providerType: 'OPENAI',
      displayName: 'OpenAI runtime',
      status: 'READY',
      models: ['test-model'],
    });
    expect(JSON.stringify(provider)).not.toContain('API_KEY');
  });

  it('stays hidden until endpoint and model are both configured', () => {
    expect(
      configuredRuntimeProvider({
        AGENT_PROVIDER_TYPE: 'openai',
        AGENT_PROVIDER_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
      }),
    ).toBeNull();
  });
});

describe('GET /api/settings', () => {
  it('returns provider and worker settings without secrets', async () => {
    const userId = `settings-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const created = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Settings Studio' }),
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = await created.json();
    expect(createdPayload.organization).toBeTruthy();
    const organizationId = createdPayload.organization.id as string;
    const response = await GET(
      new Request('http://localhost/api/settings', {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      runtime: { mode: 'local-fake', providerType: 'fake' },
      providers: [{ displayName: 'Local fake provider', status: 'READY' }],
      workers: [],
    });
    expect(JSON.stringify(payload)).not.toContain('API_PROVIDER_KEY');
  });
});
