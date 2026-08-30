import { describe, expect, it } from 'vitest';
import {
  FakeRuntime,
  RuntimeError,
  type AgentRuntime,
  type RunEvent,
} from '@bunker-studio/agent-runtime';
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

  it('uses the existing provider session when quota fails after session start', async () => {
    let starts = 0;
    let resumes = 0;
    const runtime: AgentRuntime = {
      getCapabilities: async () => ({ text: true, resume: true, streaming: true }),
      async *start(): AsyncIterable<RunEvent> {
        starts += 1;
        yield { sequence: 1, type: 'SESSION_STARTED', sessionId: 'provider-session' };
        throw new RuntimeError('QUOTA_EXHAUSTED_RESETTABLE', 'try later');
      },
      async *resume(): AsyncIterable<RunEvent> {
        resumes += 1;
        yield { sequence: 2, type: 'TEXT_DELTA', text: 'resumed', sessionId: 'provider-session' };
        yield { sequence: 3, type: 'COMPLETED', sessionId: 'provider-session' };
      },
      cancel: async () => undefined,
      probeAvailability: async () => 'AVAILABLE',
    };

    const result = await runWithAutomaticQuotaResume(runtime, {
      agentId: 'a',
      prompt: 'continue',
      correlationId: 'c',
    });

    expect(result.result.text).toBe('resumed');
    expect(starts).toBe(1);
    expect(resumes).toBe(1);
  });
});
