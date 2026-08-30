export type WorkerHealth = { service: 'worker'; status: 'ok'; timestamp: string };

export function getWorkerHealth(): WorkerHealth {
  return { service: 'worker', status: 'ok', timestamp: new Date().toISOString() };
}
