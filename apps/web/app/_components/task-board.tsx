'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Project = { id: string; name: string };
type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  taskType: string;
  state: string;
  estimatedCost: number;
  priority: number;
};
type Design = { id: string; version: number; status: string };

const nextStates: Record<string, string[]> = {
  DRAFT: ['READY', 'CANCELED'],
  READY: ['QUEUED', 'BLOCKED', 'CANCELED'],
  QUEUED: ['RUNNING', 'WAITING_DEPENDENCY', 'WAITING_APPROVAL', 'CANCELED'],
  RUNNING: ['VERIFYING', 'WAITING_PROVIDER_QUOTA', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  WAITING_DEPENDENCY: ['QUEUED', 'BLOCKED', 'CANCELED'],
  WAITING_APPROVAL: ['READY', 'CANCELED'],
  WAITING_PROVIDER_QUOTA: ['QUEUED', 'CANCELED'],
  WAITING_BUDGET_APPROVAL: ['READY', 'CANCELED'],
  BLOCKED: ['READY', 'CANCELED'],
  IMPLEMENTED: ['VERIFYING'],
  VERIFYING: ['REVIEW_PENDING', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  REVIEW_PENDING: ['DONE', 'FIX_REQUIRED'],
  FIX_REQUIRED: ['READY'],
  FAILED_RETRYABLE: ['QUEUED'],
};

export function TaskBoard() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [approvedDesignVersionId, setApprovedDesignVersionId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('BACKEND');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextOrganizationId: string) {
    if (!nextOrganizationId) return;
    setError('');
    const headers = apiHeaders(nextOrganizationId);
    const [projectsResponse, tasksResponse, designsResponse] = await Promise.all([
      fetch(`/api/organizations/${nextOrganizationId}/projects`, { headers }),
      fetch('/api/tasks', { headers }),
      fetch('/api/designs', { headers }),
    ]);
    if (!projectsResponse.ok || !tasksResponse.ok || !designsResponse.ok) {
      setError('Could not load projects and tasks for this organization.');
      return;
    }
    const projectsPayload = (await projectsResponse.json()) as { projects?: Project[] };
    const tasksPayload = (await tasksResponse.json()) as { tasks?: Task[] };
    const designsPayload = (await designsResponse.json()) as { versions?: Design[] };
    const nextProjects = projectsPayload.projects ?? [];
    setProjects(nextProjects);
    setProjectId((current) =>
      nextProjects.some((project) => project.id === current)
        ? current
        : (nextProjects[0]?.id ?? ''),
    );
    setTasks(tasksPayload.tasks ?? []);
    const approved = (designsPayload.versions ?? []).filter(
      (design) => design.status === 'APPROVED',
    );
    setDesigns(approved);
    setApprovedDesignVersionId((current) =>
      approved.some((design) => design.id === current) ? current : (approved[0]?.id ?? ''),
    );
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organization');
        const payload = (await response.json()) as { organizations?: Organization[] };
        const next = payload.organizations ?? [];
        setOrganizations(next);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = next.some((item) => item.id === saved) ? saved! : (next[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected);
      })
      .catch(() => setError('Create or select an organization to manage tasks.'));
  }, []);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    void load(value);
  }

  async function createTask() {
    setError('');
    setNotice('');
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        title,
        description: '',
        taskType,
        dependencies: [],
        writeScope: [],
        estimatedCost: Number(estimatedCost),
        priority: 0,
        ...(taskType === 'FRONTEND' ? { approvedDesignVersionId } : {}),
      }),
    });
    if (!response.ok) {
      setError('The task could not be created.');
      return;
    }
    setTitle('');
    setEstimatedCost('0');
    setNotice('Task created in DRAFT.');
    await load(organizationId);
  }

  async function transition(task: Task, state: string) {
    setError('');
    setNotice('');
    const response = await fetch(`/api/tasks?taskId=${task.id}`, {
      method: 'PATCH',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    if (!response.ok) {
      setError('The transition was rejected by the task state machine or policy.');
      return;
    }
    setNotice(`Task moved to ${state}.`);
    await load(organizationId);
  }

  return (
    <section className="live-panel" aria-label="Task workflow board">
      <div className="live-panel-toolbar">
        <label htmlFor="tasks-organization">Organization</label>
        <select
          id="tasks-organization"
          value={organizationId}
          onChange={(event) => selectOrganization(event.target.value)}
          disabled={!organizations.length}
        >
          {!organizations.length && <option value="">No organizations</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      <div className="task-create-form">
        <label htmlFor="task-project">Project</label>
        <select
          id="task-project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={!projects.length}
        >
          {!projects.length && <option value="">Create a project first</option>}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <label htmlFor="task-title">Task title</label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
        />
        <label htmlFor="task-type">Type</label>
        <select
          id="task-type"
          value={taskType}
          onChange={(event) => setTaskType(event.target.value)}
        >
          {['FRONTEND', 'BACKEND', 'DESIGN', 'TEST', 'DOCS', 'REVIEW'].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
        <label htmlFor="task-cost">Estimated cost</label>
        <input
          id="task-cost"
          type="number"
          min="0"
          step="0.01"
          value={estimatedCost}
          onChange={(event) => setEstimatedCost(event.target.value)}
        />
        {taskType === 'FRONTEND' && (
          <>
            <label htmlFor="task-design">Approved design version</label>
            <select
              id="task-design"
              value={approvedDesignVersionId}
              onChange={(event) => setApprovedDesignVersionId(event.target.value)}
              disabled={!designs.length}
              required
            >
              {!designs.length && <option value="">Approve a design first</option>}
              {designs.map((design) => (
                <option key={design.id} value={design.id}>
                  Design v{design.version}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          className="primary-button"
          type="button"
          disabled={
            !organizationId ||
            !projectId ||
            !title.trim() ||
            (taskType === 'FRONTEND' && !approvedDesignVersionId)
          }
          onClick={() => void createTask()}
        >
          Create task
        </button>
      </div>
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
      <div className="live-records task-records">
        {tasks.length === 0 && !error && <span className="empty-state">Nothing recorded yet.</span>}
        {tasks.map((task) => {
          const transitions = nextStates[task.state] ?? [];
          return (
            <div className="live-record" key={task.id}>
              <span>
                <strong>{task.title}</strong>
                <small>
                  {task.taskType} · {task.state} · ${task.estimatedCost.toFixed(2)}
                </small>
              </span>
              {transitions.length > 0 && (
                <select
                  aria-label={`Transition ${task.title}`}
                  value=""
                  onChange={(event) => {
                    if (event.target.value) void transition(task, event.target.value);
                  }}
                >
                  <option value="">Move to…</option>
                  {transitions.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
