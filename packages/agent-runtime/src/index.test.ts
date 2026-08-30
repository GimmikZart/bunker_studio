import { describe, expect, it } from 'vitest';
import { FakeRuntime, collectRun } from './index';

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
});
