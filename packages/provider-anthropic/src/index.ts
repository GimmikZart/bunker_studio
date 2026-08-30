import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';

export const PACKAGE_NAME = '@bunker-studio/provider-anthropic';
export function createAnthropicRuntime(
  options: { endpoint: string; apiKey?: string; model?: string } | undefined = undefined,
): AgentRuntime {
  return options
    ? new HttpAgentRuntime({ provider: 'anthropic', ...options })
    : new FakeRuntime({ provider: 'anthropic' });
}
