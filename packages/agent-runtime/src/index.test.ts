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
});
