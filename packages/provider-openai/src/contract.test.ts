import { describe, expect, it } from 'vitest';
import { collectRun } from '@bunker-studio/agent-runtime';
import { createOpenAIRuntime, discoverOpenAITextModels } from './index';

describe('OpenAI adapter contract', () => {
  it('returns normalized runtime output', async () => {
    const result = await collectRun(createOpenAIRuntime(), {
      agentId: 'a',
      prompt: 'ping',
      correlationId: 'c',
    });
    expect(result.text).toContain('ping');
  });

  it('sends OpenAI headers and preserves provider usage metadata', async () => {
    let request: RequestInit | undefined;
    const result = await collectRun(
      createOpenAIRuntime({
        endpoint: 'https://api.openai.test/v1/responses',
        apiKey: 'test-key',
        model: 'test-model',
        fetchFn: async (_input, init) => {
          request = init;
          return new Response(
            JSON.stringify({
              output_text: 'provider response',
              usage: { input_tokens: 4, output_tokens: 3 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        },
      }),
      { agentId: 'a', prompt: 'ping', correlationId: 'c' },
    );
    const headers = request?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-key');
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: 'test-model',
      input: 'ping',
      stream: true,
    });
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 3 });
  });
});

describe('OpenAI model discovery', () => {
  it('returns account-visible text models without exposing non-text runtimes', async () => {
    const models = await discoverOpenAITextModels({
      apiKey: 'secret',
      fetchFn: async (_input, init) => {
        expect(init?.headers).toEqual({ authorization: 'Bearer secret' });
        return new Response(
          JSON.stringify({
            data: [
              { id: 'gpt-test' },
              { id: 'gpt-image-test' },
              { id: 'text-embedding-test' },
              { id: 'o3-test' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    expect(models.map((model) => model.id)).toEqual(['gpt-test', 'o3-test']);
  });
});
