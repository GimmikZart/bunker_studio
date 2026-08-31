import type { AgentRuntime } from '@bunker-studio/agent-runtime';
import { collectRun } from '@bunker-studio/agent-runtime';
import type { LocalWorkerTask, RuntimeWorkerClient, RuntimeWorkerIdentity } from './runtime-client';

export type LocalTaskRunStatus = 'IDLE' | 'COMPLETED' | 'RETRY_SCHEDULED' | 'FAILED';
export type LocalTaskExecutor = (task: LocalWorkerTask) => Promise<Record<string, unknown>>;

export function createRuntimeTaskExecutor(runtime: AgentRuntime): LocalTaskExecutor {
  return async (task) => {
    const result = await collectRun(runtime, {
      agentId: task.taskId,
      prompt: [
        `Task: ${task.title}`,
        task.description,
        `Read scope: ${task.readScope.join(', ') || '(none)'}`,
        `Write scope: ${task.writeScope.join(', ') || '(none)'}`,
        `Definition of done: ${JSON.stringify(task.definitionOfDone)}`,
      ].join('\n\n'),
      correlationId: crypto.randomUUID(),
      capabilities: {
        skills: task.requiredCapability ? [task.requiredCapability] : [],
        tools: [],
        permissions: [],
      },
    });
    return {
      text: result.text,
      provider: result.provider,
      sessionId: result.sessionId,
      usage: result.usage,
    };
  };
}

export class LocalWorkerTaskLoop {
  constructor(
    private readonly client: RuntimeWorkerClient,
    private readonly identity: RuntimeWorkerIdentity,
    private readonly execute: LocalTaskExecutor,
  ) {}

  async runOnce(): Promise<LocalTaskRunStatus> {
    const task = await this.client.claimTask(this.identity.nodeId, this.identity.credential);
    if (!task) return 'IDLE';
    try {
      const result = await this.execute(task);
      await this.client.completeTask({
        nodeId: this.identity.nodeId,
        credential: this.identity.credential,
        leaseId: task.leaseId,
        success: true,
        result,
      });
      return 'COMPLETED';
    } catch (error) {
      const completion = await this.client.completeTask({
        nodeId: this.identity.nodeId,
        credential: this.identity.credential,
        leaseId: task.leaseId,
        success: false,
        error: error instanceof Error ? error.message.slice(0, 2_000) : 'Local task failed.',
      });
      return completion.state === 'FAILED_FINAL' ? 'FAILED' : 'RETRY_SCHEDULED';
    }
  }
}
