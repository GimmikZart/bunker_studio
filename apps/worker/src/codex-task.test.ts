import { describe, expect, it } from 'vitest';
import { agentCommandEvidence, codexEnvironment, codexTaskPrompt } from './codex-task';
import type { LocalWorkerTask } from './runtime-client';

describe('Codex task boundary', () => {
  it('does not pass control-plane or database secrets to the Codex child process', () => {
    const environment = codexEnvironment({
      PATH: 'bin',
      USERPROFILE: 'profile',
      WORKER_CREDENTIAL: 'worker-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'database-secret',
      STUDIO_MASTER_KEY: 'master-secret',
    });
    expect(environment).toEqual({ PATH: 'bin', USERPROFILE: 'profile' });
    expect(JSON.stringify(environment)).not.toContain('secret');
  });

  it('includes task scopes and prohibits publication inside the agent harness', () => {
    const prompt = codexTaskPrompt({
      title: 'Implement feature',
      description: 'Add the requested behavior.',
      readScope: ['apps/web'],
      writeScope: ['apps/web/app'],
      definitionOfDone: { items: ['tests pass'] },
      agent: {
        name: 'Maya',
        title: 'Frontend Engineer',
        role_key: 'frontend',
        personality_json: { tone: 'direct' },
      },
    } as unknown as LocalWorkerTask);
    expect(prompt).toContain('apps/web/app');
    expect(prompt).toContain('Do not push, merge, or deploy');
  });

  it('records executed checks without persisting their potentially sensitive output', () => {
    const evidence = agentCommandEvidence([
      {
        id: 'command-1',
        type: 'command_execution',
        command: 'pnpm test',
        aggregated_output: 'output that must remain local',
        exit_code: 0,
        status: 'completed',
      },
    ]);
    expect(evidence).toEqual([{ command: 'pnpm test', status: 'completed', exitCode: 0 }]);
    expect(JSON.stringify(evidence)).not.toContain('must remain local');
  });
});
