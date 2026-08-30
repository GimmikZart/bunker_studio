import { describe, expect, it } from 'vitest';
import { collectRun } from '@bunker-studio/agent-runtime';
import { createCompatibleFakeRuntime, createCompatibleRuntime } from './index';

describe('OpenAI-compatible adapter contract', () => {
  it('accepts local and remote HTTP endpoints', async () => {
    const result = await collectRun(createCompatibleFakeRuntime(), {
      agentId: 'a',
      prompt: 'ping',
      correlationId: 'c',
    });
    expect(result.text).toContain('ping');
  });

  it('normalizes an OpenAI-compatible JSON response', async () => {
    const result = await collectRun(
      createCompatibleRuntime({
        endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
        model: 'local-model',
        fetchFn: async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: 'local response' } }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      }),
      { agentId: 'a', prompt: 'ping', correlationId: 'c' },
    );
    expect(result.text).toBe('local response');
    expect(result.provider).toBe('openai-compatible');
  });

  it('normalizes an OpenAI-compatible SSE response', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"local"}}]}\n\n'));
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":" stream"}}]}\n\n'),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const result = await collectRun(
      createCompatibleRuntime({
        endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
        fetchFn: async () =>
          new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      }),
      { agentId: 'a', prompt: 'ping', correlationId: 'c' },
    );
    expect(result.text).toBe('local stream');
  });
});
