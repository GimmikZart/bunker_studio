import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';

export const PACKAGE_NAME = '@bunker-studio/provider-openai';
export function createOpenAIRuntime(
  options: { endpoint: string; apiKey?: string; model?: string } | undefined = undefined,
): AgentRuntime {
  return options
    ? new HttpAgentRuntime({ provider: 'openai', ...options })
    : new FakeRuntime({ provider: 'openai' });
}
