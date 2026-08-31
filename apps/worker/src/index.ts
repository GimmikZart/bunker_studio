import { getWorkerHealth } from './health.js';
import { createRuntimeWorkerClient } from './runtime-client.js';

const intervalMs = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 60_000);
const controlPlaneUrl = process.env.WORKER_CONTROL_PLANE_URL?.trim();
const registrationToken = process.env.WORKER_REGISTRATION_TOKEN?.trim();
const nodeId = process.env.WORKER_NODE_ID?.trim();
const credential = process.env.WORKER_CREDENTIAL?.trim();
const workerName = process.env.WORKER_NAME?.trim() || 'Bunker local worker';
const capabilities = (process.env.WORKER_CAPABILITIES ?? 'chat')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

let heartbeat: ReturnType<typeof setInterval> | null = null;
let runtimeIdentity = nodeId && credential ? { nodeId, credential } : null;

function stopHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

async function start() {
  console.log(JSON.stringify({ event: 'worker.started', ...getWorkerHealth(), intervalMs }));
  if (!controlPlaneUrl || (!runtimeIdentity && !registrationToken)) {
    heartbeat = setInterval(() => {
      console.log(JSON.stringify({ event: 'worker.heartbeat', ...getWorkerHealth() }));
    }, intervalMs);
    return;
  }
  try {
    const client = createRuntimeWorkerClient({ baseUrl: controlPlaneUrl });
    runtimeIdentity ??= await client.register({
      name: workerName,
      capabilities,
      registrationToken: registrationToken!,
    });
    console.log(JSON.stringify({ event: 'worker.registered', nodeId: runtimeIdentity.nodeId }));
    const beat = async () => {
      try {
        await client.heartbeat(runtimeIdentity!.nodeId, runtimeIdentity!.credential);
        console.log(JSON.stringify({ event: 'worker.heartbeat', ...getWorkerHealth() }));
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'worker.heartbeat_failed',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    };
    await beat();
    heartbeat = setInterval(() => void beat(), intervalMs);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'worker.registration_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  }
}

void start();

function shutdown() {
  stopHeartbeat();
  console.log(JSON.stringify({ event: 'worker.stopped', timestamp: new Date().toISOString() }));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
