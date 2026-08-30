import { describe, expect, it } from 'vitest';
import { collectRun } from '@bunker-studio/agent-runtime';
import { createOpenAIRuntime } from './index';

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
        endpoint: 'https://api.openai.test/v1/chat/completions',
        apiKey: 'test-key',
        model: 'test-model',
        fetchFn: async (_input, init) => {
          request = init;
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: 'provider response' } }],
              usage: { prompt_tokens: 4, completion_tokens: 3 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        },
      }),
      { agentId: 'a', prompt: 'ping', correlationId: 'c' },
    );
    const headers = request?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-key');
    expect(JSON.parse(String(request?.body))).toMatchObject({ model: 'test-model', stream: true });
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 3 });
  });
});
