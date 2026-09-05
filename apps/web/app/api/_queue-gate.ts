/**
 * What must be true before a task may start.
 *
 * These conditions used to live only inside the PATCH handler for a task, which
 * was fine while a person pressed the button. Now the studio queues work by
 * itself, and a second path that skipped these checks would put a Codex task on
 * a repository that is not connected, or one with no security verification, and
 * the refusal would arrive far too late.
 */

export type QueueCandidate = {
  writeScope: string[];
  verificationCommands?: { kind: string }[];
  assignedAgentId?: string;
};

export type QueueAgent = {
  providerConnectionId: string;
  providerModelId: string;
  runtimeType: string;
};

export type QueueRepository = {
  providerType: string;
  status: string;
} | null;

export type QueueReadiness = { ok: true } | { ok: false; reason: string };

export function queueReadiness(input: {
  task: QueueCandidate;
  agent: QueueAgent | null;
  repository: QueueRepository;
}): QueueReadiness {
  const { task, agent, repository } = input;
  if (!task.assignedAgentId || !agent)
    return { ok: false, reason: 'Assign an agent before queueing this task.' };
  if (
    agent.providerConnectionId === 'unbound' ||
    agent.providerModelId === 'unconfigured' ||
    agent.runtimeType === 'UNCONFIGURED'
  )
    return {
      ok: false,
      reason: 'The assigned agent needs a provider, model, and runtime before queueing.',
    };
  if (agent.runtimeType !== 'CODEX_SDK') return { ok: true };

  if (!task.writeScope.length)
    return { ok: false, reason: 'A Codex repository task requires at least one write scope.' };
  if (!task.verificationCommands?.length)
    return {
      ok: false,
      reason: 'A Codex repository task requires at least one deterministic verification command.',
    };
  if (!task.verificationCommands.some((command) => command.kind === 'SECURITY'))
    return {
      ok: false,
      reason: 'A Codex repository task requires a baseline security verification command.',
    };
  if (!repository || repository.providerType !== 'GITHUB' || repository.status !== 'CONNECTED')
    return {
      ok: false,
      reason: 'Connect a writable GitHub repository before queueing a Codex task.',
    };
  return { ok: true };
}
