'use client';

import { useEffect, useState } from 'react';
import { FieldLabel } from './help-tip';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Project = { id: string; name: string };
type Agent = { id: string; name: string; title: string };
type PlanTask = {
  id: string;
  title: string;
  taskType: string;
  description: string;
  dependencies: string[];
  readScope: string[];
  writeScope: string[];
  definitionOfDone: string[];
  estimatedCost: number;
  parallelGroupId?: string;
  approvedDesignVersionId?: string;
};
type Plan = {
  goal: string;
  assumptions: string[];
  verificationSteps: string[];
  tasks: PlanTask[];
};

const split = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Asks the Lead to decompose a goal, shows the proposal for review, and creates
 * the tasks only on an explicit second action. Nothing the Lead proposes becomes
 * work until the Owner says so.
 */
export function LeadPlannerPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projectId, setProjectId] = useState('');
  const [leadAgentId, setLeadAgentId] = useState('');
  const [goal, setGoal] = useState('');
  const [constraints, setConstraints] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(id: string) {
    if (!id) return;
    const [projectsResponse, agentsResponse] = await Promise.all([
      fetch(`/api/organizations/${id}/projects`, { headers: apiHeaders(id) }),
      fetch('/api/agents', { headers: apiHeaders(id) }),
    ]);
    if (!projectsResponse.ok || !agentsResponse.ok) throw new Error('load');
    setProjects(((await projectsResponse.json()) as { projects?: Project[] }).projects ?? []);
    setAgents(((await agentsResponse.json()) as { agents?: Agent[] }).agents ?? []);
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organizations');
        const values =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(values);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const id = values.some((item) => item.id === saved) ? saved! : (values[0]?.id ?? '');
        setOrganizationId(id);
        await load(id);
      })
      .catch(() => setError('Create an organization before planning work.'));
  }, []);

  async function requestPlan() {
    if (!organizationId || !projectId || !leadAgentId)
      return setError('Choose a project and the Lead who should plan it.');
    if (!goal.trim()) return setError('Describe what the studio must deliver.');
    setError('');
    setNotice('');
    setPlan(null);
    setBusy(true);
    try {
      const response = await fetch('/api/workflows/plan/generate', {
        method: 'POST',
        headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, leadAgentId, goal, constraints: split(constraints) }),
      });
      const payload = (await response.json()) as {
        plan?: Plan;
        order?: string[];
        error?: string;
        reasons?: string[];
      };
      if (!response.ok) {
        // Show why the plan was refused: these are the studio's own rules, and
        // the Lead can be asked again with a clearer goal.
        setError(
          [payload.error ?? 'The Lead could not produce a plan.', ...(payload.reasons ?? [])].join(
            ' ',
          ),
        );
        return;
      }
      setPlan(payload.plan ?? null);
      setOrder(payload.order ?? []);
      setNotice('Review the proposal. Nothing is created until you accept it.');
    } catch {
      setError('The Lead could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  async function acceptPlan() {
    if (!organizationId || !plan) return;
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/workflows/plan', {
        method: 'POST',
        headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, plan }),
      });
      const payload = (await response.json()) as { error?: string; reasons?: string[] };
      if (!response.ok) {
        setError(
          [payload.error ?? 'The plan could not be created.', ...(payload.reasons ?? [])].join(' '),
        );
        return;
      }
      setPlan(null);
      setOrder([]);
      setNotice('Tasks created. They are on the board in dependency order.');
    } catch {
      setError('The plan could not be created.');
    } finally {
      setBusy(false);
    }
  }

  const orderedTasks: PlanTask[] = plan
    ? order.flatMap((id) => {
        const task = plan.tasks.find((candidate) => candidate.id === id);
        return task ? [task] : [];
      })
    : [];
  const totalCost = plan ? plan.tasks.reduce((total, task) => total + task.estimatedCost, 0) : 0;

  return (
    <section className="live-panel" aria-label="Lead planner">
      <div className="live-panel-toolbar">
        <label htmlFor="plan-org">Organization</label>
        <select
          id="plan-org"
          value={organizationId}
          onChange={(event) => {
            setOrganizationId(event.target.value);
            window.localStorage.setItem('bunker-organization-id', event.target.value);
            setPlan(null);
            void load(event.target.value);
          }}
        >
          <option value="">Choose an organization</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>

      <div className="resource-form">
        <label htmlFor="plan-project">Project</label>
        <select
          id="plan-project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">Choose a project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <FieldLabel
          htmlFor="plan-lead"
          help="The agent that breaks the goal into tasks. Give this one a stronger model: planning badly is expensive further down."
        >
          Lead
        </FieldLabel>
        <select
          id="plan-lead"
          value={leadAgentId}
          onChange={(event) => setLeadAgentId(event.target.value)}
        >
          <option value="">Choose the agent who plans</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} — {agent.title}
            </option>
          ))}
        </select>

        <FieldLabel
          htmlFor="plan-goal"
          help="The outcome you want, in plain words. Describe the result, not the steps: working out the steps is what you are asking the Lead to do."
        >
          What must be delivered
        </FieldLabel>
        <textarea
          id="plan-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="Describe the outcome, not the tasks."
        />

        <FieldLabel
          htmlFor="plan-constraints"
          help="Rules the plan must respect, one per line, such as a deadline or a technology to avoid."
        >
          Constraints (one per line, optional)
        </FieldLabel>
        <textarea
          id="plan-constraints"
          value={constraints}
          onChange={(event) => setConstraints(event.target.value)}
          rows={3}
          placeholder={'No new dependencies\nMust ship behind a flag'}
        />

        <button className="primary-button" type="button" onClick={requestPlan} disabled={busy}>
          {busy ? 'Working…' : 'Ask the Lead to plan'}
        </button>
      </div>

      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p aria-live="polite">{notice}</p>}

      {plan && (
        <div className="plan-proposal">
          <h3>{plan.goal}</h3>
          <p>
            {orderedTasks.length} task{orderedTasks.length === 1 ? '' : 's'}, estimated {totalCost}
          </p>
          {plan.assumptions.length > 0 && (
            <>
              <h4>Assumptions</h4>
              <ul>
                {plan.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </>
          )}
          <ol>
            {orderedTasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong> <span className="plan-pill">{task.taskType}</span>
                <p>{task.description}</p>
                <p className="plan-muted">
                  Writes: {task.writeScope.join(', ') || 'nothing'}
                  {task.dependencies.length > 0 && ` · after ${task.dependencies.join(', ')}`}
                  {task.parallelGroupId && ` · parallel group ${task.parallelGroupId}`}
                </p>
                <ul>
                  {task.definitionOfDone.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <h4>Verification</h4>
          <ul>
            {plan.verificationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <div className="action-row">
            <button className="primary-button" type="button" onClick={acceptPlan} disabled={busy}>
              Create these tasks
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setPlan(null);
                setNotice('Proposal discarded. Nothing was created.');
              }}
              disabled={busy}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
