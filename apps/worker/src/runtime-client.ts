export type RuntimeWorkerIdentity = {
  nodeId: string;
  credential: string;
};

export type LocalWorkerTask = {
  leaseId: string;
  taskId: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string;
  taskType: string;
  state: string;
  readScope: string[];
  writeScope: string[];
  definitionOfDone: Record<string, unknown>;
  requiredCapability?: string | null;
  attemptNumber: number;
  leaseExpiresAt: string;
};

export type RuntimeWorkerClient = {
  register: (input: {
    name: string;
    capabilities: string[];
    registrationToken: string;
  }) => Promise<RuntimeWorkerIdentity>;
  heartbeat: (nodeId: string, credential: string) => Promise<void>;
  claimTask: (nodeId: string, credential: string) => Promise<LocalWorkerTask | null>;
  completeTask: (input: {
    nodeId: string;
    credential: string;
    leaseId: string;
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
  }) => Promise<{ id: string; state: string; retryCount: number }>;
};

export function createRuntimeWorkerClient(input: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): RuntimeWorkerClient {
  const baseUrl = input.baseUrl.replace(/\/$/, '');
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error('Worker control-plane URL must use HTTP(S).');
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    register: async (registration) => {
      const response = await fetchImpl(`${baseUrl}/api/workers/runtime/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(registration),
      });
      if (!response.ok)
        throw new Error(`Worker registration failed with status ${response.status}.`);
      const body = (await response.json()) as {
        worker?: { id?: unknown };
        credential?: unknown;
      };
      if (typeof body.worker?.id !== 'string' || typeof body.credential !== 'string')
        throw new Error('Worker registration response is invalid.');
      return { nodeId: body.worker.id, credential: body.credential };
    },
    heartbeat: async (nodeId, credential) => {
      const response = await fetchImpl(`${baseUrl}/api/workers/runtime/heartbeat`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ nodeId }),
      });
      if (!response.ok) throw new Error(`Worker heartbeat failed with status ${response.status}.`);
    },
    claimTask: async (nodeId, credential) => {
      const response = await fetchImpl(`${baseUrl}/api/workers/runtime/tasks/claim`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ nodeId }),
      });
      if (!response.ok) throw new Error(`Worker task claim failed with status ${response.status}.`);
      const body = (await response.json()) as { task?: LocalWorkerTask | null };
      if (!body.task) return null;
      if (
        typeof body.task.leaseId !== 'string' ||
        typeof body.task.taskId !== 'string' ||
        typeof body.task.title !== 'string' ||
        !Array.isArray(body.task.readScope) ||
        !Array.isArray(body.task.writeScope)
      )
        throw new Error('Worker task claim response is invalid.');
      return body.task;
    },
    completeTask: async (task) => {
      const response = await fetchImpl(`${baseUrl}/api/workers/runtime/tasks/complete`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${task.credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: task.nodeId,
          leaseId: task.leaseId,
          success: task.success,
          result: task.result ?? {},
          ...(task.error ? { error: task.error } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(`Worker task completion failed with status ${response.status}.`);
      const body = (await response.json()) as {
        task?: { id?: unknown; state?: unknown; retryCount?: unknown };
      };
      if (
        typeof body.task?.id !== 'string' ||
        typeof body.task.state !== 'string' ||
        typeof body.task.retryCount !== 'number'
      )
        throw new Error('Worker task completion response is invalid.');
      return { id: body.task.id, state: body.task.state, retryCount: body.task.retryCount };
    },
  };
}
