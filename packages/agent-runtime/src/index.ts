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
    },
  ) {}

  async getCapabilities() {
    return { text: true, resume: false, streaming: false };
  }

  async *start(input: RunRequest): AsyncIterable<RunEvent> {
    const sessionId = input.sessionId ?? `http-session-${crypto.randomUUID()}`;
    yield { sequence: 1, type: 'SESSION_STARTED', sessionId, provider: this.config.provider };
    const response = await (this.config.fetchFn ?? fetch)(this.config.endpoint, {
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
    });
    if (!response.ok) throw normalizeHttpError(response.status, response.statusText);
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      content?: { text?: string }[];
    };
    const text = payload.choices?.[0]?.message?.content ?? payload.content?.[0]?.text ?? '';
    yield { sequence: 2, type: 'TEXT_DELTA', text, sessionId, provider: this.config.provider };
    yield { sequence: 3, type: 'COMPLETED', sessionId, provider: this.config.provider };
  }

  resume(input: RunRequest & { sessionId: string }): AsyncIterable<RunEvent> {
    return this.start(input);
  }
  async cancel() {
    return undefined;
  }
  async probeAvailability() {
    return 'AVAILABLE' as const;
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

export async function collectRun(runtime: AgentRuntime, input: RunRequest): Promise<RunResult> {
  let text = '';
  let sessionId = input.sessionId ?? '';
  let provider = 'normalized';
  for await (const event of runtime.start(input)) {
    sessionId = event.sessionId;
    provider = event.provider ?? provider;
    if (event.type === 'TEXT_DELTA') text += event.text ?? '';
  }
  return {
    sessionId,
    text,
    usage: { inputTokens: input.prompt.length, outputTokens: text.length },
    provider,
  };
}
