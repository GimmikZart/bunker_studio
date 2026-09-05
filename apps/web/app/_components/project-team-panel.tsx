'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';
import { AgentAvatar } from './agent-shared';

type Member = {
  assignmentId: string;
  id: string;
  name: string;
  title: string;
  roleKey: string;
  avatarAssetId: string | null;
  skills: string[];
};
type Available = {
  id: string;
  name: string;
  title: string;
  roleKey: string;
  avatarAssetId: string | null;
};

/**
 * The team of one project: who is on it, who could be, and where they go next.
 *
 * This is what makes a plan executable. The worker refuses a task with no
 * assigned agent, and until now nothing outside the API could put an agent on a
 * project — so a studio could hire a full staff and still watch every plan sit
 * still.
 */
export function ProjectTeamPanel({
  organizationId,
  projectId,
  projectName,
  otherProjects,
  onChanged,
}: {
  organizationId: string;
  projectId: string;
  projectName: string;
  otherProjects: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/agents`, {
      headers: apiHeaders(organizationId),
    }).catch(() => null);
    setLoading(false);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? 'The team of this project could not be read.');
      return;
    }
    setError('');
    const payload = (await response.json()) as { members?: Member[]; available?: Available[] };
    setMembers(payload.members ?? []);
    setAvailable(payload.available ?? []);
    setPicked([]);
  }, [organizationId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(request: () => Promise<Response | null>, failure: string) {
    setBusy(true);
    setError('');
    const response = await request();
    setBusy(false);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? failure);
      return;
    }
    await load();
    onChanged();
  }

  const roles = new Set(members.map((member) => member.roleKey));
  // Said plainly, because a plan will fail on exactly these two: only a
  // reviewer can review, and only a designer's work may be cited by frontend.
  const gaps = ['lead', 'reviewer'].filter((role) => !roles.has(role));

  return (
    <div className="project-team">
      <h3>Team</h3>
      {loading && <p className="field-help">Reading the team…</p>}

      {!loading && members.length === 0 && (
        <p className="field-help">
          Nobody works on {projectName} yet. A task can only run once an agent is on the project, so
          a plan made now would produce work nobody can take.
        </p>
      )}

      {members.length > 0 && (
        <ul className="project-member-list">
          {members.map((member) => (
            <li key={member.assignmentId}>
              <AgentAvatar agent={member} size="small" />
              <span className="project-member-identity">
                <strong>{member.name}</strong>
                <small>
                  {member.title} · {member.roleKey}
                </small>
              </span>
              <span className="project-member-actions">
                {otherProjects.length > 0 && (
                  <select
                    aria-label={`Move ${member.name} to another project`}
                    disabled={busy}
                    onChange={(event) => {
                      const target = event.target.value;
                      event.currentTarget.value = '';
                      if (!target) return;
                      void change(
                        () =>
                          fetch(`/api/projects/${target}/agents`, {
                            method: 'POST',
                            headers: {
                              ...apiHeaders(organizationId),
                              'content-type': 'application/json',
                            },
                            body: JSON.stringify({
                              agentIds: [member.id],
                              fromProjectId: projectId,
                            }),
                          }).catch(() => null),
                        `${member.name} could not be moved.`,
                      );
                    }}
                    value=""
                  >
                    <option value="">Move to…</option>
                    {otherProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void change(
                      () =>
                        fetch(`/api/projects/${projectId}/agents?agentId=${member.id}`, {
                          method: 'DELETE',
                          headers: apiHeaders(organizationId),
                        }).catch(() => null),
                      `${member.name} could not be taken off the project.`,
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {members.length > 0 && gaps.length > 0 && (
        <p className="field-help">
          No {gaps.join(' and no ')} on this project. A review task can only be done by an agent
          whose role is reviewer, and the plan is written by a lead.
        </p>
      )}

      {available.length > 0 ? (
        <div className="project-team-add">
          <label htmlFor={`add-agents-${projectId}`}>Put someone on this project</label>
          <select
            id={`add-agents-${projectId}`}
            multiple
            onChange={(event) =>
              setPicked([...event.target.selectedOptions].map((option) => option.value))
            }
            size={Math.min(5, available.length)}
            value={picked}
          >
            {available.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} — {agent.roleKey}
              </option>
            ))}
          </select>
          <button
            className="secondary-button"
            disabled={busy || !picked.length}
            onClick={() =>
              void change(
                () =>
                  fetch(`/api/projects/${projectId}/agents`, {
                    method: 'POST',
                    headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
                    body: JSON.stringify({ agentIds: picked }),
                  }).catch(() => null),
                'The agents could not be assigned.',
              )
            }
            type="button"
          >
            {picked.length > 1 ? `Assign ${picked.length} agents` : 'Assign'}
          </button>
        </div>
      ) : (
        !loading && (
          <p className="field-help">
            Every agent of this organization is already on this project.{' '}
            <Link href="/agents/new">Hire another one.</Link>
          </p>
        )
      )}

      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
