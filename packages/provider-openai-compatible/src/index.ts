import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';

export const PACKAGE_NAME = '@bunker-studio/provider-openai-compatible';
export function createCompatibleRuntime(options: {
  endpoint: string;
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
}): AgentRuntime {
  if (!options.endpoint.startsWith('http://') && !options.endpoint.startsWith('https://'))
    throw new Error('Provider endpoint must be an HTTP(S) URL.');
  return new HttpAgentRuntime({
    provider: 'openai-compatible',
    ...options,
    buildRequest: (input, context) => ({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(context.apiKey ? { authorization: `Bearer ${context.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: context.model,
        messages: [{ role: 'user', content: input.prompt }],
        stream: true,
        stream_options: { include_usage: true },
        ...(context.resume && input.sessionId ? { session_id: input.sessionId } : {}),
        capabilities: input.capabilities ?? { skills: [], tools: [], permissions: [] },
      }),
    }),
    capabilities: { streaming: true, resume: false },
  });
}

export function createCompatibleFakeRuntime(): AgentRuntime {
  return new FakeRuntime({ provider: 'openai-compatible' });
}
