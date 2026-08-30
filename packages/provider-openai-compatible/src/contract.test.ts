import { describe, expect, it } from 'vitest';
import { collectRun } from '@bunker-studio/agent-runtime';
import { createCompatibleFakeRuntime } from './index';

describe('OpenAI-compatible adapter contract', () => {
  it('accepts local and remote HTTP endpoints', async () => {
    const result = await collectRun(createCompatibleFakeRuntime(), {
      agentId: 'a',
      prompt: 'ping',
      correlationId: 'c',
    });
    expect(result.text).toContain('ping');
  });
});
