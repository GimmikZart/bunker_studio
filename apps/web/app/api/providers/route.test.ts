import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveActorId: vi.fn(),
  getWebOperationalRepository: vi.fn(),
  createWorkerServiceSupabaseClient: vi.fn(),
  discoverOpenAITextModels: vi.fn(),
  discoverAnthropicModels: vi.fn(),
}));

vi.mock('../_auth', () => ({ resolveActorId: mocks.resolveActorId }));
vi.mock('../_data', () => ({ getWebOperationalRepository: mocks.getWebOperationalRepository }));
vi.mock('../_supabase', () => ({
  createWorkerServiceSupabaseClient: mocks.createWorkerServiceSupabaseClient,
}));
vi.mock('@bunker-studio/provider-openai', () => ({
  discoverOpenAITextModels: mocks.discoverOpenAITextModels,
}));
vi.mock('@bunker-studio/provider-anthropic', () => ({
  discoverAnthropicModels: mocks.discoverAnthropicModels,
}));

import { POST } from './route';

describe('provider connection route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('discovers models without inference and persists only an encrypted API key', async () => {
    vi.stubEnv('STUDIO_MASTER_KEY', Buffer.alloc(32, 7).toString('base64url'));
    mocks.resolveActorId.mockResolvedValue('11111111-1111-4111-8111-111111111111');
    mocks.getWebOperationalRepository.mockResolvedValue({
      getRole: vi.fn(async () => 'OWNER'),
      listProviders: vi.fn(async () => []),
    });
    mocks.discoverOpenAITextModels.mockResolvedValue([
      { id: 'gpt-test', capabilities: ['text', 'streaming', 'tool-calling'] },
    ]);
    const rpc = vi.fn(async (name: string, input: Record<string, unknown>) => {
      void name;
      void input;
      return {
        data: '22222222-2222-4222-8222-222222222222',
        error: null,
      };
    });
    mocks.createWorkerServiceSupabaseClient.mockReturnValue({ rpc });

    const response = await POST(
      new Request('http://localhost/api/providers', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bunker-organization-id': '33333333-3333-4333-8333-333333333333',
        },
        body: JSON.stringify({
          providerType: 'OPENAI',
          displayName: 'OpenAI account',
          apiKey: 'sk-provider-secret',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(JSON.stringify(await response.json())).not.toContain('sk-provider-secret');
    expect(mocks.discoverOpenAITextModels).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-provider-secret' }),
    );
    const rpcInput = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(rpcInput.input_encrypted_secret)).not.toContain('sk-provider-secret');
    expect(rpcInput.input_models).toEqual([
      {
        id: 'gpt-test',
        displayName: 'gpt-test',
        capabilities: ['text', 'streaming', 'tool-calling'],
      },
    ]);
  });
});
