import { Codex, type ModelReasoningEffort } from '@openai/codex-sdk';
import { cleanupGitWorkspace, prepareGitWorkspace, publishGitWorkspace } from './git-workspace.js';
import type { LocalTaskExecutor } from './local-task.js';
import type { LocalWorkerTask } from './runtime-client.js';
import type { ThreadItem } from '@openai/codex-sdk';

const SAFE_ENVIRONMENT_KEYS = [
  'APPDATA',
  'COMSPEC',
  'HOME',
  'LOCALAPPDATA',
  'PATH',
  'PATHEXT',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'USERPROFILE',
] as const;

export function codexEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return Object.fromEntries(
    SAFE_ENVIRONMENT_KEYS.flatMap((key) =>
      typeof environment[key] === 'string' ? [[key, environment[key]]] : [],
    ),
  );
}

export function codexTaskPrompt(task: LocalWorkerTask): string {
  return [
    `You are ${task.agent.name}, ${task.agent.title}.`,
    `Role: ${task.agent.role_key}.`,
    `Personality configuration: ${JSON.stringify(task.agent.personality_json)}.`,
    '',
    `Implement this task completely: ${task.title}`,
    task.description,
    '',
    `Authorized read scope: ${task.readScope.join(', ') || '(repository instructions and write scope only)'}.`,
    `Authorized write scope: ${task.writeScope.join(', ')}.`,
    `Definition of done: ${JSON.stringify(task.definitionOfDone)}.`,
    '',
    'Read and obey repository instructions such as AGENTS.md before editing.',
    'Make the requested changes and run the relevant checks. Do not push, merge, or deploy; the worker handles Git publication after validating scope.',
  ].join('\n');
}

export function commandEvidence(items: ThreadItem[]) {
  return items
    .filter((item) => item.type === 'command_execution')
    .map((item) => ({
      command: item.command.slice(0, 1_000),
      status: item.status,
      exitCode: item.exit_code ?? null,
    }));
}

function reasoningEffort(
  value: LocalWorkerTask['binding']['reasoningEffort'],
): ModelReasoningEffort {
  return value === 'none' ? 'minimal' : value;
}

export function createCodexTaskExecutor(input: {
  workspaceRoot: string;
  networkAccessEnabled?: boolean;
}): LocalTaskExecutor {
  return async (task) => {
    if (task.binding.runtimeType !== 'CODEX_SDK' || task.provider.type !== 'OPENAI')
      throw new Error('Codex SDK tasks require an OpenAI provider binding.');
    if (!task.writeScope.length)
      throw new Error('A coding task requires at least one explicit write scope.');
    const workspace = await prepareGitWorkspace(task, input.workspaceRoot);
    try {
      const codex = new Codex({
        apiKey: task.provider.apiKey,
        baseUrl: task.provider.apiBaseUrl,
        env: codexEnvironment(),
      });
      const thread = codex.startThread({
        model: task.binding.providerModelId,
        modelReasoningEffort: reasoningEffort(task.binding.reasoningEffort),
        workingDirectory: workspace.path,
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never',
        networkAccessEnabled: input.networkAccessEnabled ?? false,
        webSearchMode: 'disabled',
      });
      const turn = await thread.run(codexTaskPrompt(task));
      const publication = await publishGitWorkspace(task, workspace);
      return {
        text: turn.finalResponse,
        provider: 'openai-codex-sdk',
        model: task.binding.providerModelId,
        sessionId: thread.id,
        usage: turn.usage
          ? {
              inputTokens: turn.usage.input_tokens,
              cachedInputTokens: turn.usage.cached_input_tokens,
              outputTokens: turn.usage.output_tokens,
              reasoningOutputTokens: turn.usage.reasoning_output_tokens,
            }
          : null,
        checks: commandEvidence(turn.items),
        ...publication,
      };
    } finally {
      await cleanupGitWorkspace(workspace);
    }
  };
}
