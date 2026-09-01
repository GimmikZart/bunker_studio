import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';

export const PACKAGE_NAME = '@bunker-studio/provider-anthropic';

type AnthropicRuntimeOptions = {
  endpoint: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  fetchFn?: typeof fetch;
};

export type DiscoveredAnthropicModel = {
  id: string;
  displayName: string;
  capabilities: string[];
};

export async function discoverAnthropicModels(input: {
  apiKey: string;
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<DiscoveredAnthropicModel[]> {
  const baseUrl = (input.apiBaseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
  const response = await (input.fetchFn ?? fetch)(`${baseUrl}/models?limit=1000`, {
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': input.apiKey,
    },
  });
  if (!response.ok) throw new Error(`Anthropic model catalog returned status ${response.status}.`);
  const payload = (await response.json()) as {
    data?: { id?: unknown; display_name?: unknown; capabilities?: unknown }[];
  };
  if (!Array.isArray(payload.data)) throw new Error('Anthropic model catalog response is invalid.');
  return payload.data
    .filter((model): model is typeof model & { id: string } => typeof model.id === 'string')
    .map((model) => ({
      id: model.id,
      displayName: typeof model.display_name === 'string' ? model.display_name : model.id,
      capabilities: ['text', 'streaming', 'tool-calling'],
    }));
}

export function createAnthropicRuntime(
  options: AnthropicRuntimeOptions | undefined = undefined,
): AgentRuntime {
  if (!options) return new FakeRuntime({ provider: 'anthropic' });
  let inputTokens: number | undefined;
  return new HttpAgentRuntime({
    provider: 'anthropic',
    ...options,
    buildRequest: (input, context) => ({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(context.apiKey ? { 'x-api-key': context.apiKey } : {}),
      },
      body: JSON.stringify({
        model: context.model,
        max_tokens: options.maxTokens ?? 4096,
        messages: [{ role: 'user', content: input.prompt }],
        stream: true,
        ...(context.resume && input.sessionId ? { metadata: { session_id: input.sessionId } } : {}),
      }),
    }),
    parseResponse: parseAnthropicResponse,
    parseStreamChunk: (payload) => {
      const chunk = parseAnthropicStreamChunk(payload, inputTokens);
      if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
      return chunk;
    },
    capabilities: { streaming: true, resume: false },
  });
}

function parseAnthropicResponse(payload: unknown) {
  const item = payload as {
    content?: { text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    text: item.content?.[0]?.text ?? '',
    usage:
      typeof item.usage?.input_tokens === 'number' && typeof item.usage?.output_tokens === 'number'
        ? { inputTokens: item.usage.input_tokens, outputTokens: item.usage.output_tokens }
        : undefined,
  };
}

function parseAnthropicStreamChunk(payload: unknown, previousInputTokens?: number) {
  const item = payload as {
    type?: string;
    delta?: { type?: string; text?: string; usage?: { output_tokens?: number } };
    message?: { usage?: { input_tokens?: number } };
  };
  const currentInputTokens =
    typeof item.message?.usage?.input_tokens === 'number'
      ? item.message.usage.input_tokens
      : previousInputTokens;
  return {
    text: item.type === 'content_block_delta' ? item.delta?.text : undefined,
    done: item.type === 'message_stop',
    usage:
      typeof currentInputTokens === 'number' && typeof item.delta?.usage?.output_tokens === 'number'
        ? {
            inputTokens: currentInputTokens,
            outputTokens: item.delta.usage.output_tokens,
          }
        : undefined,
    inputTokens: currentInputTokens,
  };
}
