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
    parseStreamChunk: parseOpenAICompatibleStreamChunk,
    capabilities: { streaming: true, resume: false },
  });
}

function parseOpenAICompatibleStreamChunk(payload: unknown) {
  const item = payload as {
    choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: item.choices?.[0]?.delta?.content,
    done: Boolean(item.choices?.[0]?.finish_reason),
    usage:
      typeof item.usage?.prompt_tokens === 'number' &&
      typeof item.usage?.completion_tokens === 'number'
        ? { inputTokens: item.usage.prompt_tokens, outputTokens: item.usage.completion_tokens }
        : undefined,
  };
}

export function createCompatibleFakeRuntime(): AgentRuntime {
  return new FakeRuntime({ provider: 'openai-compatible' });
}
