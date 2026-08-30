import { getWorkerHealth } from './health.js';

const intervalMs = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 60_000);

console.log(JSON.stringify({ event: 'worker.started', ...getWorkerHealth(), intervalMs }));

const heartbeat = setInterval(() => {
  console.log(JSON.stringify({ event: 'worker.heartbeat', ...getWorkerHealth() }));
}, intervalMs);

process.on('SIGTERM', () => {
  clearInterval(heartbeat);
  console.log(JSON.stringify({ event: 'worker.stopped', timestamp: new Date().toISOString() }));
});
