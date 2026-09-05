'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Stage = {
  key: string;
  name: string;
  roleKey: string;
  gate: string;
  produces: string;
  status: 'DONE' | 'CURRENT' | 'PENDING' | 'SKIPPED';
  waitingFor?: string;
};

/**
 * How far this project has got, and what is holding it.
 *
 * Nothing here is stored: the stages are read from the brief, the tasks and the
 * plan every time. A project cannot therefore claim to be somewhere the work
 * left days ago.
 */
export function ProjectStagesPanel({
  organizationId,
  projectId,
  onChanged,
}: {
  organizationId: string;
  projectId: string;
  onChanged: () => void;
}) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [playbook, setPlaybook] = useState<{ key: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/stages`, {
      headers: apiHeaders(organizationId),
    }).catch(() => null);
    setLoading(false);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? 'The progress of this project could not be read.');
      return;
    }
    setError('');
    const payload = (await response.json()) as {
      stages: Stage[];
      playbook: { key: string; name: string };
    };
    setStages(payload.stages ?? []);
    setPlaybook(payload.playbook ?? null);
  }, [organizationId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function writeSpecification() {
    setBusy(true);
    setNotice('');
    setError('');
    const response = await fetch(`/api/projects/${projectId}/stages/spec`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      // A change to documentation still runs the studio's baseline check on the
      // repository it lands in.
      body: JSON.stringify({
        verificationCommands: [
          { kind: 'SECURITY', executable: 'pnpm', args: ['audit', '--audit-level', 'high'] },
        ],
      }),
    }).catch(() => null);
    setBusy(false);
    const payload = (await response?.json().catch(() => ({}))) as { error?: string; path?: string };
    if (!response?.ok) {
      setError(payload?.error ?? 'The specification could not be started.');
      return;
    }
    setNotice(`The Lead is writing ${payload.path}, on its own branch.`);
    await load();
    onChanged();
  }

  const current = stages.find((stage) => stage.status === 'CURRENT');

  return (
    <div className="project-stages">
      <h3>Progress{playbook ? ` · ${playbook.name}` : ''}</h3>
      {loading && <p className="field-help">Reading the progress…</p>}

      {stages.length > 0 && (
        <ol className="stage-list">
          {stages.map((stage) => (
            <li className={`stage stage-${stage.status.toLowerCase()}`} key={stage.key}>
              <span className="stage-mark" aria-hidden="true" />
              <span className="stage-body">
                <strong>{stage.name}</strong>
                <small>
                  {stage.status === 'CURRENT'
                    ? stage.waitingFor
                    : stage.status === 'SKIPPED'
                      ? 'not needed for this project'
                      : stage.produces}
                </small>
              </span>
            </li>
          ))}
        </ol>
      )}

      {current?.key === 'spec' && (
        <div className="action-row">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void writeSpecification()}
            type="button"
          >
            {busy ? 'Starting…' : 'Have the Lead write it'}
          </button>
        </div>
      )}

      {notice && (
        <p className="live-summary" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
