export type RuntimeWorkerIdentity = {
  nodeId: string;
  credential: string;
};

export type RuntimeWorkerClient = {
  register: (input: {
    name: string;
    capabilities: string[];
    registrationToken: string;
  }) => Promise<RuntimeWorkerIdentity>;
  heartbeat: (nodeId: string, credential: string) => Promise<void>;
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
  };
}
