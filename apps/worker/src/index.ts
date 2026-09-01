import { getWorkerHealth } from './health.js';
import { createCompatibleRuntime } from '@bunker-studio/provider-openai-compatible';
import { createOpenAIRuntime } from '@bunker-studio/provider-openai';
import { createAnthropicRuntime } from '@bunker-studio/provider-anthropic';
import { createStudioServiceClient } from '@bunker-studio/db';
import {
  createVapidPushClient,
  dispatchPendingPushNotifications,
} from '@bunker-studio/notifications';
import { createSupabaseNotificationSource } from './notification-source.js';
import { createSupabaseReportSource } from './report-source.js';
import { dispatchDueWeeklyReports } from './report-scheduler.js';
import { LocalWorkerTaskLoop, createBoundRuntimeTaskExecutor } from './local-task.js';
import type { LocalWorkerTask } from './runtime-client.js';
import { loadWorkerIdentity, saveWorkerIdentity } from './identity-store.js';
import { createCodexTaskExecutor } from './codex-task.js';
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
const taskPollIntervalMs = Number(process.env.WORKER_TASK_POLL_INTERVAL_MS ?? 2_000);

let heartbeat: ReturnType<typeof setInterval> | null = null;
let notificationTimer: ReturnType<typeof setInterval> | null = null;
let reportTimer: ReturnType<typeof setInterval> | null = null;
let taskTimer: ReturnType<typeof setInterval> | null = null;
let runtimeIdentity = nodeId && credential ? { nodeId, credential } : null;

function stopHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = null;
  if (reportTimer) clearInterval(reportTimer);
  reportTimer = null;
  if (taskTimer) clearInterval(taskTimer);
  taskTimer = null;
}

function startReportDispatcher() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;
  const pollIntervalMs = Number(process.env.WORKER_REPORT_POLL_INTERVAL_MS ?? 60_000);
  const source = createSupabaseReportSource(createStudioServiceClient({ url, serviceRoleKey }));
  const dispatch = () => {
    void dispatchDueWeeklyReports(source)
      .then((result) => {
        if (result.generated || result.duplicates || result.failed)
          console.log(JSON.stringify({ event: 'worker.report_dispatch', ...result }));
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            event: 'worker.report_dispatch_failed',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      });
  };
  dispatch();
  reportTimer = setInterval(dispatch, pollIntervalMs);
}

function startNotificationDispatcher() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!url || !serviceRoleKey || !subject || !publicKey || !privateKey) return;
  const pollIntervalMs = Number(process.env.WORKER_PUSH_POLL_INTERVAL_MS ?? 5_000);
  const source = createSupabaseNotificationSource(
    createStudioServiceClient({ url, serviceRoleKey }),
  );
  const client = createVapidPushClient({ subject, publicKey, privateKey });
  const dispatch = () => {
    void dispatchPendingPushNotifications(source, client)
      .then((result) => {
        if (result.delivered || result.deferred || result.revoked)
          console.log(JSON.stringify({ event: 'worker.push_dispatch', ...result }));
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            event: 'worker.push_dispatch_failed',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      });
  };
  dispatch();
  notificationTimer = setInterval(dispatch, pollIntervalMs);
}

function startTaskLoop(client: ReturnType<typeof createRuntimeWorkerClient>) {
  if (!runtimeIdentity) return;
  const runtimeFor = (task: LocalWorkerTask) => {
    const baseUrl = task.provider.apiBaseUrl.replace(/\/$/, '');
    const common = { apiKey: task.provider.apiKey, model: task.binding.providerModelId };
    if (task.binding.runtimeType === 'OPENAI')
      return createOpenAIRuntime({
        endpoint: `${baseUrl}/responses`,
        reasoningEffort: task.binding.reasoningEffort,
        ...common,
      });
    if (task.binding.runtimeType === 'ANTHROPIC')
      return createAnthropicRuntime({ endpoint: `${baseUrl}/messages`, ...common });
    if (task.binding.runtimeType === 'OPENAI_COMPATIBLE')
      return createCompatibleRuntime({ endpoint: `${baseUrl}/chat/completions`, ...common });
    throw new Error('The selected coding runtime is not installed on this worker yet.');
  };
  const directExecutor = createBoundRuntimeTaskExecutor(runtimeFor);
  const workspaceRoot = process.env.WORKER_WORKSPACE_ROOT?.trim();
  const codexExecutor = workspaceRoot
    ? createCodexTaskExecutor({
        workspaceRoot,
        networkAccessEnabled: process.env.WORKER_CODEX_NETWORK_ACCESS === 'true',
      })
    : null;
  const loop = new LocalWorkerTaskLoop(client, runtimeIdentity, (task) => {
    if (task.binding.runtimeType !== 'CODEX_SDK') return directExecutor(task);
    if (!codexExecutor)
      throw new Error('WORKER_WORKSPACE_ROOT is required for Codex repository tasks.');
    return codexExecutor(task);
  });
  const poll = () => {
    void loop
      .runOnce()
      .then((status) => {
        if (status !== 'IDLE') console.log(JSON.stringify({ event: 'worker.task', status }));
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            event: 'worker.task_failed',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      });
  };
  poll();
  taskTimer = setInterval(poll, taskPollIntervalMs);
}

async function start() {
  console.log(JSON.stringify({ event: 'worker.started', ...getWorkerHealth(), intervalMs }));
  startNotificationDispatcher();
  startReportDispatcher();
  runtimeIdentity ??= await loadWorkerIdentity();
  if (!controlPlaneUrl || (!runtimeIdentity && !registrationToken)) {
    heartbeat = setInterval(() => {
      console.log(JSON.stringify({ event: 'worker.heartbeat', ...getWorkerHealth() }));
    }, intervalMs);
    return;
  }
  try {
    const client = createRuntimeWorkerClient({ baseUrl: controlPlaneUrl });
    if (!runtimeIdentity) {
      runtimeIdentity = await client.register({
        name: workerName,
        capabilities,
        registrationToken: registrationToken!,
      });
      await saveWorkerIdentity(runtimeIdentity);
    }
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
    startTaskLoop(client);
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
