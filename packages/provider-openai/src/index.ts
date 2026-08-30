import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';

export const PACKAGE_NAME = '@bunker-studio/provider-openai';

type OpenAIRuntimeOptions = {
  endpoint: string;
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
};

export function createOpenAIRuntime(
  options: OpenAIRuntimeOptions | undefined = undefined,
): AgentRuntime {
  return options
    ? new HttpAgentRuntime({
        provider: 'openai',
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
        parseResponse: parseOpenAIResponse,
        parseStreamChunk: parseOpenAIStreamChunk,
        capabilities: { streaming: true, resume: false },
      })
    : new FakeRuntime({ provider: 'openai' });
}

function parseOpenAIResponse(payload: unknown) {
  const item = payload as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: item.choices?.[0]?.message?.content ?? '',
    usage:
      typeof item.usage?.prompt_tokens === 'number' &&
      typeof item.usage?.completion_tokens === 'number'
        ? { inputTokens: item.usage.prompt_tokens, outputTokens: item.usage.completion_tokens }
        : undefined,
  };
}

function parseOpenAIStreamChunk(payload: unknown) {
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
