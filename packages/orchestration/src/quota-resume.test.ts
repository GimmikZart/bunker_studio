import { describe, expect, it } from 'vitest';
import { FakeRuntime } from '@bunker-studio/agent-runtime';
import { runWithAutomaticQuotaResume } from './index';

describe('durable quota resume', () => {
  it('automatically resumes after a resettable provider quota interruption', async () => {
    const result = await runWithAutomaticQuotaResume(
      new FakeRuntime({ quotaFailuresBeforeAvailable: 1 }),
      { agentId: 'a', prompt: 'continue', correlationId: 'c' },
    );
    expect(result.result.text).toContain('continue');
    expect(result.trace).toMatchObject({ state: 'COMPLETED', retryCount: 1 });
    expect(result.trace.nextRetryAt).toBeDefined();
  });
});
