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
});
