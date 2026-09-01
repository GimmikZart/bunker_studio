import { FakeRuntime, HttpAgentRuntime, type AgentRuntime } from '@bunker-studio/agent-runtime';

export const PACKAGE_NAME = '@bunker-studio/provider-openai';

type OpenAIRuntimeOptions = {
  endpoint: string;
  apiKey?: string;
  model?: string;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  fetchFn?: typeof fetch;
};

export type DiscoveredOpenAIModel = {
  id: string;
  capabilities: string[];
};

const NON_TEXT_MODEL_MARKERS = [
  'audio',
  'dall-e',
  'embedding',
  'image',
  'moderation',
  'realtime',
  'sora',
  'speech',
  'transcribe',
  'tts',
  'video',
  'whisper',
];

export async function discoverOpenAITextModels(input: {
  apiKey: string;
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<DiscoveredOpenAIModel[]> {
  const baseUrl = (input.apiBaseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const response = await (input.fetchFn ?? fetch)(`${baseUrl}/models`, {
    headers: { authorization: `Bearer ${input.apiKey}` },
  });
  if (!response.ok) throw new Error(`OpenAI model catalog returned status ${response.status}.`);
  const payload = (await response.json()) as { data?: { id?: unknown }[] };
  if (!Array.isArray(payload.data)) throw new Error('OpenAI model catalog response is invalid.');
  return payload.data
    .map((model) => model.id)
    .filter((id): id is string => typeof id === 'string')
    .filter((id) => !NON_TEXT_MODEL_MARKERS.some((marker) => id.toLowerCase().includes(marker)))
    .filter((id) => /^(chatgpt-|codex-|gpt-|o\d)/i.test(id))
    .map((id) => ({ id, capabilities: ['text', 'streaming', 'tool-calling'] }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

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
            input: input.prompt,
            stream: true,
            ...(options.reasoningEffort && options.reasoningEffort !== 'none'
              ? { reasoning: { effort: options.reasoningEffort } }
              : {}),
            ...(context.resume && input.sessionId ? { previous_response_id: input.sessionId } : {}),
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
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text =
    item.output_text ??
    item.output
      ?.flatMap((output) => output.content ?? [])
      .filter((content) => content.type === 'output_text')
      .map((content) => content.text ?? '')
      .join('') ??
    '';
  return {
    text,
    usage:
      typeof item.usage?.input_tokens === 'number' && typeof item.usage?.output_tokens === 'number'
        ? { inputTokens: item.usage.input_tokens, outputTokens: item.usage.output_tokens }
        : undefined,
  };
}

function parseOpenAIStreamChunk(payload: unknown) {
  const item = payload as {
    type?: string;
    delta?: string;
    response?: { usage?: { input_tokens?: number; output_tokens?: number } };
  };
  return {
    text: item.type === 'response.output_text.delta' ? item.delta : undefined,
    done: item.type === 'response.completed',
    usage:
      typeof item.response?.usage?.input_tokens === 'number' &&
      typeof item.response.usage.output_tokens === 'number'
        ? {
            inputTokens: item.response.usage.input_tokens,
            outputTokens: item.response.usage.output_tokens,
          }
        : undefined,
  };
}
