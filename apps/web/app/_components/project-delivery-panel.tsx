'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Task = {
  id: string;
  title: string;
  state: string;
  dependencies: string[];
  assignedAgentId?: string;
};

/**
 * What the project is actually doing, and what it is waiting for.
 *
 * The studio moves work on by itself, so the question stops being "what do I
 * press" and becomes "where is it stuck". Every line here answers that: a task
 * names what it waits for, and blocked work says what is missing rather than
 * sitting silently in a queue.
 */

const GROUPS: { key: string; label: string; states: string[] }[] = [
  { key: 'running', label: 'In flight', states: ['QUEUED', 'RUNNING', 'IMPLEMENTED', 'VERIFYING'] },
  { key: 'review', label: 'Waiting on review', states: ['REVIEW_PENDING', 'FIX_REQUIRED'] },
  {
    key: 'waiting',
    label: 'Waiting',
    states: [
      'READY',
      'DRAFT',
      'WAITING_DEPENDENCY',
      'WAITING_APPROVAL',
      'WAITING_PROVIDER_QUOTA',
      'WAITING_BUDGET_APPROVAL',
    ],
  },
  { key: 'stuck', label: 'Stuck', states: ['BLOCKED', 'FAILED_RETRYABLE', 'FAILED_FINAL'] },
  { key: 'done', label: 'Done', states: ['DONE', 'CANCELED'] },
];

function stateLabel(state: string): string {
  return state.replace(/_/g, ' ').toLocaleLowerCase();
}

export function ProjectDeliveryPanel({
  organizationId,
  projectId,
  agentNames,
  onChanged,
}: {
  organizationId: string;
  projectId: string;
  agentNames: Map<string, string>;
  onChanged: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/tasks', { headers: apiHeaders(organizationId) }).catch(
      () => null,
    );
    setLoading(false);
    if (!response?.ok) {
      setError('The work of this project could not be read.');
      return;
    }
    setError('');
    setTasks(
      (
        ((await response.json()) as { tasks?: (Task & { projectId: string })[] }).tasks ?? []
      ).filter((task) => task.projectId === projectId),
    );
  }, [organizationId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function advance() {
    setAdvancing(true);
    setNotice('');
    setError('');
    const response = await fetch(`/api/projects/${projectId}/advance`, {
      method: 'POST',
      headers: apiHeaders(organizationId),
    }).catch(() => null);
    setAdvancing(false);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? 'The project could not be advanced.');
      return;
    }
    const result = (await response.json()) as {
      moves?: { to: string }[];
      holds?: { reason: string }[];
    };
    const started = (result.moves ?? []).filter((move) => move.to === 'QUEUED').length;
    setNotice(
      started
        ? `${started} task${started === 1 ? '' : 's'} started.`
        : (result.moves?.length ?? 0) > 0
          ? 'The queue was reorganised; nothing new could start yet.'
          : 'Nothing left to start right now.',
    );
    await load();
    onChanged();
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const grouped = GROUPS.map((group) => ({
    ...group,
    tasks: tasks.filter((task) => group.states.includes(task.state)),
  })).filter((group) => group.tasks.length);

  function waitingOn(task: Task): string {
    const pending = task.dependencies
      .map((dependency) => byId.get(dependency))
      .filter((dependency) => dependency && dependency.state !== 'DONE')
      .map((dependency) => dependency!.title);
    if (pending.length) return `waiting for ${pending.join(', ')}`;
    if (task.state === 'BLOCKED' && !task.assignedAgentId)
      return 'nobody on this project can do it';
    if (task.assignedAgentId) return (agentNames.get(task.assignedAgentId) ?? 'assigned') + '';
    return 'unassigned';
  }

  return (
    <div className="project-delivery">
      <h3>Delivery</h3>
      {loading && <p className="field-help">Reading the work…</p>}
      {!loading && tasks.length === 0 && (
        <p className="field-help">
          No work yet. A plan from the Lead becomes tasks here, and the studio starts what it can on
          its own.
        </p>
      )}

      {grouped.map((group) => (
        <div className="delivery-group" key={group.key}>
          <h4>
            {group.label} <span>{group.tasks.length}</span>
          </h4>
          <ul>
            {group.tasks.map((task) => (
              <li key={task.id}>
                <span className={`delivery-dot delivery-dot-${group.key}`} aria-hidden="true" />
                <span className="delivery-task">
                  <strong>{task.title}</strong>
                  <small>
                    {stateLabel(task.state)} · {waitingOn(task)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {tasks.length > 0 && (
        <div className="action-row">
          <button
            className="secondary-button"
            disabled={advancing}
            onClick={() => void advance()}
            type="button"
          >
            {advancing ? 'Advancing…' : 'Advance now'}
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
