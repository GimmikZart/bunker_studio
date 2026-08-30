import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';

export const PACKAGE_NAME = '@bunker-studio/provider-openai-compatible';
export function createCompatibleRuntime(options: { endpoint: string }): AgentRuntime {
  if (!options.endpoint.startsWith('http://') && !options.endpoint.startsWith('https://'))
    throw new Error('Provider endpoint must be an HTTP(S) URL.');
  return new HttpAgentRuntime({ provider: 'openai-compatible', ...options });
}

export function createCompatibleFakeRuntime(): AgentRuntime {
  return new FakeRuntime({ provider: 'openai-compatible' });
}
