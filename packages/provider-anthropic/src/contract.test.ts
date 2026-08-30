import { describe, expect, it } from 'vitest';
import { collectRun } from '@bunker-studio/agent-runtime';
import { createAnthropicRuntime } from './index';

describe('Anthropic adapter contract', () => {
  it('returns normalized runtime output', async () => {
    const result = await collectRun(createAnthropicRuntime(), {
      agentId: 'a',
      prompt: 'ping',
      correlationId: 'c',
    });
    expect(result.text).toContain('ping');
  });

  it('sends Anthropic headers and parses native usage fields', async () => {
    let request: RequestInit | undefined;
    const result = await collectRun(
      createAnthropicRuntime({
        endpoint: 'https://api.anthropic.test/v1/messages',
        apiKey: 'test-key',
        model: 'claude-test',
        fetchFn: async (_input, init) => {
          request = init;
          return new Response(
            JSON.stringify({
              content: [{ type: 'text', text: 'provider response' }],
              usage: { input_tokens: 5, output_tokens: 6 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        },
      }),
      { agentId: 'a', prompt: 'ping', correlationId: 'c' },
    );
    const headers = request?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: 'claude-test',
      max_tokens: 4096,
      stream: true,
    });
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 6 });
  });
});
