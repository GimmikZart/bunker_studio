import { describe, expect, it } from 'vitest';
import { FakeRuntime, HttpAgentRuntime, collectRun } from './index';

describe('FakeRuntime', () => {
  it('normalizes streaming output and keeps a resumable session', async () => {
    const runtime = new FakeRuntime({ response: 'done' });
    const result = await collectRun(runtime, {
      agentId: 'agent',
      prompt: 'ship it',
      correlationId: 'corr',
    });
    expect(result.text).toBe('done');
    expect(result.sessionId).toMatch(/^fake-session-/);
  });

  it('returns a normalized resettable quota error', async () => {
    const runtime = new FakeRuntime({ quotaFailuresBeforeAvailable: 1 });
    await expect(
      collectRun(runtime, { agentId: 'agent', prompt: 'ship it', correlationId: 'corr' }),
    ).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED_RESETTABLE' });
    expect(await runtime.probeAvailability()).toBe('AVAILABLE');
  });

  it('keeps the capability envelope explicit at the runtime boundary', async () => {
    const runtime = new FakeRuntime({ response: 'scoped' });
    const result = await collectRun(runtime, {
      agentId: 'agent',
      prompt: 'inspect',
      correlationId: 'corr',
      capabilities: { skills: ['backend'], tools: ['repository'], permissions: ['repo.read'] },
    });
    expect(result.text).toBe('scoped');
  });

  it('sends only the supplied capability envelope to an HTTP provider', async () => {
    let body: Record<string, unknown> | undefined;
    const runtime = new HttpAgentRuntime({
      provider: 'test-provider',
      endpoint: 'http://provider.test/run',
      fetchFn: async (_input, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    await collectRun(runtime, {
      agentId: 'agent',
      prompt: 'inspect',
      correlationId: 'corr',
      capabilities: { skills: ['backend'], tools: ['repository'], permissions: ['repo.read'] },
    });
    expect(body?.capabilities).toEqual({
      skills: ['backend'],
      tools: ['repository'],
      permissions: ['repo.read'],
    });
  });

  it('normalizes server-sent streaming chunks and provider usage', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text":"hel"}\n\n'));
        controller.enqueue(
          encoder.encode('data: {"text":"lo","usage":{"inputTokens":2,"outputTokens":2}}\n\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"usage":{"inputTokens":3,"outputTokens":4}}\n\n'),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const runtime = new HttpAgentRuntime({
      provider: 'stream-provider',
      endpoint: 'http://provider.test/stream',
      fetchFn: async () =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      parseStreamChunk: (payload) =>
        payload as { text?: string; usage?: { inputTokens: number; outputTokens: number } },
    });

    const result = await collectRun(runtime, {
      agentId: 'agent',
      prompt: 'stream',
      correlationId: 'corr',
    });

    expect(result.text).toBe('hello');
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
    expect(await runtime.getCapabilities()).toMatchObject({ streaming: true });
  });

  it('keeps usage-only terminal streaming events', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text":"ok"}\n\n'));
        controller.enqueue(
          encoder.encode('data: {"usage":{"inputTokens":7,"outputTokens":8}}\n\n'),
        );
        controller.close();
      },
    });
    const runtime = new HttpAgentRuntime({
      provider: 'usage-provider',
      endpoint: 'http://provider.test/stream',
      fetchFn: async () =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      parseStreamChunk: (payload) =>
        payload as { text?: string; usage?: { inputTokens: number; outputTokens: number } },
    });

    const result = await collectRun(runtime, {
      agentId: 'agent',
      prompt: 'stream',
      correlationId: 'corr',
    });

    expect(result.text).toBe('ok');
    expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 8 });
  });
});
