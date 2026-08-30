export const PACKAGE_NAME = '@bunker-studio/agent-runtime';

export type RuntimeEventType =
  'SESSION_STARTED' | 'TEXT_DELTA' | 'TOOL_REQUESTED' | 'COMPLETED' | 'FAILED';
export type RuntimeErrorCode =
  | 'RATE_LIMIT_TEMPORARY'
  | 'QUOTA_EXHAUSTED_RESETTABLE'
  | 'CREDITS_EXHAUSTED'
  | 'AUTH_ERROR'
  | 'PROVIDER_OUTAGE'
  | 'CONTENT/SAFETY_BLOCK'
  | 'UNKNOWN_PROVIDER_ERROR';

export type RunRequest = {
  agentId: string;
  prompt: string;
  sessionId?: string;
  correlationId: string;
  capabilities?: {
    skills: string[];
    tools: string[];
    permissions: string[];
  };
};
export type RunEvent = {
  sequence: number;
  type: RuntimeEventType;
  text?: string;
  sessionId: string;
  provider?: string;
  usage?: { inputTokens: number; outputTokens: number };
};
export type RunResult = {
  sessionId: string;
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
};

export class RuntimeError extends Error {
  constructor(
    public readonly code: RuntimeErrorCode,
    message: string,
    public readonly retryAfterMs?: number,
    public readonly sessionId?: string,
  ) {
    super(message);
    this.name = 'RuntimeError';
  }
}

export interface AgentRuntime {
  getCapabilities(): Promise<{ text: boolean; resume: boolean; streaming: boolean }>;
  start(input: RunRequest): AsyncIterable<RunEvent>;
  resume(input: RunRequest & { sessionId: string }): AsyncIterable<RunEvent>;
  cancel(input: { sessionId: string }): Promise<void>;
  probeAvailability(): Promise<'AVAILABLE' | 'WAITING'>;
}

export class FakeRuntime implements AgentRuntime {
  private readonly sessions = new Map<string, string>();
  private quotaFailuresRemaining: number;
  private canceled = new Set<string>();

  constructor(
    private readonly options: {
      provider?: string;
      quotaFailuresBeforeAvailable?: number;
      response?: string;
    } = {},
  ) {
    this.quotaFailuresRemaining = options.quotaFailuresBeforeAvailable ?? 0;
  }

  async getCapabilities() {
    return { text: true, resume: true, streaming: true };
  }

  async *start(input: RunRequest): AsyncIterable<RunEvent> {
    if (this.quotaFailuresRemaining > 0) {
      this.quotaFailuresRemaining -= 1;
      throw new RuntimeError(
        'QUOTA_EXHAUSTED_RESETTABLE',
        'Fake provider quota is temporarily exhausted.',
      );
    }
    const sessionId = input.sessionId ?? `fake-session-${crypto.randomUUID()}`;
    this.sessions.set(sessionId, input.prompt);
    yield {
      sequence: 1,
      type: 'SESSION_STARTED',
      sessionId,
      provider: this.options.provider ?? 'fake',
    };
    yield {
      sequence: 2,
      type: 'TEXT_DELTA',
      text: this.options.response ?? `Completed: ${input.prompt}`,
      sessionId,
      provider: this.options.provider ?? 'fake',
    };
    if (this.canceled.has(sessionId)) return;
    yield { sequence: 3, type: 'COMPLETED', sessionId, provider: this.options.provider ?? 'fake' };
  }

  resume(input: RunRequest & { sessionId: string }): AsyncIterable<RunEvent> {
    return this.start(input);
  }
  async cancel(input: { sessionId: string }) {
    this.canceled.add(input.sessionId);
  }
  async probeAvailability() {
    return this.quotaFailuresRemaining > 0 ? 'WAITING' : 'AVAILABLE';
  }
}

export class HttpAgentRuntime implements AgentRuntime {
  constructor(
    private readonly config: {
      provider: string;
      endpoint: string;
      apiKey?: string;
      model?: string;
      fetchFn?: typeof fetch;
      buildRequest?: (
        input: RunRequest,
        context: { apiKey?: string; model?: string; resume: boolean },
      ) => RequestInit;
      parseResponse?: (payload: unknown) => {
        text: string;
        usage?: { inputTokens: number; outputTokens: number };
      };
      parseStreamChunk?: (payload: unknown) => {
        text?: string;
        done?: boolean;
        usage?: { inputTokens: number; outputTokens: number };
      };
      capabilities?: { resume?: boolean; streaming?: boolean };
    },
  ) {}

  async getCapabilities() {
    return {
      text: true,
      resume: this.config.capabilities?.resume ?? false,
      streaming: this.config.capabilities?.streaming ?? Boolean(this.config.parseStreamChunk),
    };
  }

  async *start(input: RunRequest): AsyncIterable<RunEvent> {
    yield* this.execute(input, false);
  }

  async *resume(input: RunRequest & { sessionId: string }): AsyncIterable<RunEvent> {
    yield* this.execute(input, true);
  }

  private async *execute(input: RunRequest, resume: boolean): AsyncIterable<RunEvent> {
    const sessionId = input.sessionId ?? `http-session-${crypto.randomUUID()}`;
    yield { sequence: 1, type: 'SESSION_STARTED', sessionId, provider: this.config.provider };
    const request = this.config.buildRequest?.(input, {
      apiKey: this.config.apiKey,
      model: this.config.model,
      resume,
    }) ?? {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: input.prompt }],
        capabilities: input.capabilities ?? { skills: [], tools: [], permissions: [] },
      }),
    };
    const response = await (this.config.fetchFn ?? fetch)(this.config.endpoint, request);
    if (!response.ok) throw normalizeHttpError(response.status, response.statusText);
    const contentType = response.headers.get('content-type') ?? '';
    if (
      contentType.includes('text/event-stream') &&
      response.body &&
      this.config.parseStreamChunk
    ) {
      let sequence = 2;
      for await (const payload of parseServerSentEvents(response.body)) {
        const chunk = this.config.parseStreamChunk(payload);
        if (chunk.text !== undefined || chunk.usage !== undefined)
          yield {
            sequence,
            type: 'TEXT_DELTA',
            text: chunk.text,
            sessionId,
            provider: this.config.provider,
            usage: chunk.usage,
          };
        sequence += 1;
      }
      yield { sequence, type: 'COMPLETED', sessionId, provider: this.config.provider };
      return;
    }
    const parsed = this.config.parseResponse
      ? this.config.parseResponse(await response.json())
      : defaultResponseParser(await response.json());
    yield {
      sequence: 2,
      type: 'TEXT_DELTA',
      text: parsed.text,
      sessionId,
      provider: this.config.provider,
      usage: parsed.usage,
    };
    yield { sequence: 3, type: 'COMPLETED', sessionId, provider: this.config.provider };
  }
  async cancel() {
    return undefined;
  }
  async probeAvailability() {
    return 'AVAILABLE' as const;
  }
}

function defaultResponseParser(payload: unknown): {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
} {
  const item = payload as {
    choices?: { message?: { content?: string } }[];
    content?: { text?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: item.choices?.[0]?.message?.content ?? item.content?.[0]?.text ?? '',
    usage:
      typeof item.usage?.prompt_tokens === 'number' &&
      typeof item.usage?.completion_tokens === 'number'
        ? { inputTokens: item.usage.prompt_tokens, outputTokens: item.usage.completion_tokens }
        : undefined,
  };
}

async function* parseServerSentEvents(body: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? '' : (lines.pop() ?? '');
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        yield JSON.parse(data) as unknown;
      } catch {
        throw new RuntimeError('UNKNOWN_PROVIDER_ERROR', 'Provider returned invalid SSE data.');
      }
    }
    if (done) break;
  }
}

function normalizeHttpError(status: number, statusText: string): RuntimeError {
  if (status === 401 || status === 403)
    return new RuntimeError('AUTH_ERROR', statusText || 'Provider authentication failed.');
  if (status === 408 || status === 429)
    return new RuntimeError('RATE_LIMIT_TEMPORARY', statusText || 'Provider rate limit.', 60_000);
  if (status >= 500)
    return new RuntimeError('PROVIDER_OUTAGE', statusText || 'Provider unavailable.');
  return new RuntimeError('UNKNOWN_PROVIDER_ERROR', statusText || `Provider returned ${status}.`);
}

async function collectRuntimeStream(
  runtime: AgentRuntime,
  input: RunRequest,
  resume: boolean,
): Promise<RunResult> {
  let text = '';
  let sessionId = input.sessionId ?? '';
  let provider = 'normalized';
  let reportedUsage: { inputTokens: number; outputTokens: number } | undefined;
  try {
    const events = resume
      ? runtime.resume({ ...input, sessionId: input.sessionId ?? sessionId })
      : runtime.start(input);
    for await (const event of events) {
      sessionId = event.sessionId;
      provider = event.provider ?? provider;
      if (event.type === 'TEXT_DELTA') text += event.text ?? '';
      if (event.usage) reportedUsage = event.usage;
    }
  } catch (error) {
    if (error instanceof RuntimeError && sessionId && !error.sessionId)
      throw new RuntimeError(error.code, error.message, error.retryAfterMs, sessionId);
    throw error;
  }
  return {
    sessionId,
    text,
    usage: reportedUsage ?? { inputTokens: input.prompt.length, outputTokens: text.length },
    provider,
  };
}

export async function collectRun(runtime: AgentRuntime, input: RunRequest): Promise<RunResult> {
  return collectRuntimeStream(runtime, input, false);
}

export async function resumeRun(runtime: AgentRuntime, input: RunRequest): Promise<RunResult> {
  return collectRuntimeStream(runtime, input, true);
}
