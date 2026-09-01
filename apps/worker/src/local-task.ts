import type { AgentRuntime } from '@bunker-studio/agent-runtime';
import { collectRun } from '@bunker-studio/agent-runtime';
import type { LocalWorkerTask, RuntimeWorkerClient, RuntimeWorkerIdentity } from './runtime-client';

export type LocalTaskRunStatus = 'IDLE' | 'COMPLETED' | 'RETRY_SCHEDULED' | 'FAILED';
export type LocalTaskExecutor = (task: LocalWorkerTask) => Promise<Record<string, unknown>>;
export type RuntimeFactory = (task: LocalWorkerTask) => AgentRuntime;

export class TaskExecutionError extends Error {
  constructor(
    message: string,
    readonly result: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TaskExecutionError';
  }
}

export function createRuntimeTaskExecutor(runtime: AgentRuntime): LocalTaskExecutor {
  return async (task) => {
    const result = await collectRun(runtime, {
      agentId: task.agent.id,
      prompt: [
        `You are ${task.agent.name}, ${task.agent.title}.`,
        `Role: ${task.agent.role_key}`,
        `Personality configuration: ${JSON.stringify(task.agent.personality_json)}`,
        `Task: ${task.title}`,
        task.description,
        `Read scope: ${task.readScope.join(', ') || '(none)'}`,
        `Write scope: ${task.writeScope.join(', ') || '(none)'}`,
        `Definition of done: ${JSON.stringify(task.definitionOfDone)}`,
      ].join('\n\n'),
      correlationId: crypto.randomUUID(),
      capabilities: {
        skills: [
          ...task.agent.skills_json,
          ...(task.requiredCapability ? [task.requiredCapability] : []),
        ],
        tools: task.agent.tools_json,
        permissions: task.agent.permissions_json,
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

export function createBoundRuntimeTaskExecutor(runtimeFor: RuntimeFactory): LocalTaskExecutor {
  return async (task) => createRuntimeTaskExecutor(runtimeFor(task))(task);
}

export class LocalWorkerTaskLoop {
  constructor(
    private readonly client: RuntimeWorkerClient,
    private readonly identity: RuntimeWorkerIdentity,
    private readonly execute: LocalTaskExecutor,
    private readonly leaseRenewalIntervalMs = 30_000,
  ) {}

  async runOnce(): Promise<LocalTaskRunStatus> {
    const task = await this.client.claimTask(this.identity.nodeId, this.identity.credential);
    if (!task) return 'IDLE';
    let renewalError: unknown = null;
    const renew = () => {
      void this.client
        .renewLease({
          nodeId: this.identity.nodeId,
          credential: this.identity.credential,
          leaseId: task.leaseId,
        })
        .then(() => {
          renewalError = null;
        })
        .catch((error) => {
          renewalError = error;
        });
    };
    const renewalTimer = setInterval(renew, this.leaseRenewalIntervalMs);
    let executionResult: Record<string, unknown> | undefined;
    try {
      executionResult = await this.execute(task);
      if (renewalError) throw renewalError;
      await this.client.completeTask({
        nodeId: this.identity.nodeId,
        credential: this.identity.credential,
        leaseId: task.leaseId,
        success: true,
        result: executionResult,
      });
      return 'COMPLETED';
    } catch (error) {
      const completion = await this.client.completeTask({
        nodeId: this.identity.nodeId,
        credential: this.identity.credential,
        leaseId: task.leaseId,
        success: false,
        ...(error instanceof TaskExecutionError
          ? { result: error.result }
          : executionResult
            ? { result: executionResult }
            : {}),
        error: error instanceof Error ? error.message.slice(0, 2_000) : 'Local task failed.',
      });
      return completion.state === 'FAILED_FINAL' ? 'FAILED' : 'RETRY_SCHEDULED';
    } finally {
      clearInterval(renewalTimer);
    }
  }
}
