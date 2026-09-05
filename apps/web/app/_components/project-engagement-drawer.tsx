'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiHeaders } from './live-panel';

type Turn = { role: 'USER' | 'LEAD'; content: string };
type Brief = {
  questions: string[];
  understanding: string;
  openPoints: string[];
  proposedScope: string[];
  outOfScope: string[];
  playbookKey: string;
  readyForApproval: boolean;
};
type Playbook = {
  key: string;
  name: string;
  summary: string;
  stages: { key: string; name: string; roleKey: string; gate: string; optional: boolean }[];
  unavailable: { stage: string; missing: string[] }[];
};

/**
 * The conversation in which the studio works out what you actually want.
 *
 * The Lead asks, you answer, and what it understood is on screen the whole time
 * so you can tell it that it is wrong. Nothing is committed until you approve
 * the brief: the Lead's own opinion that it has understood is shown as such and
 * moves nothing.
 */
export function ProjectEngagementDrawer({
  organizationId,
  projectId,
  projectName,
  onClose,
  onApproved,
}: {
  organizationId: string;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [lead, setLead] = useState<{ name: string; title: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [approved, setApproved] = useState<Brief | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/engagement`, {
      headers: apiHeaders(organizationId),
    }).catch(() => null);
    setLoading(false);
    if (!response?.ok) {
      setError('The conversation could not be read.');
      return;
    }
    const payload = (await response.json()) as {
      lead: { name: string; title: string } | null;
      turns: Turn[];
      approvedBrief: Brief | null;
    };
    setLead(payload.lead);
    setTurns(payload.turns ?? []);
    setApproved(payload.approvedBrief ?? null);
  }, [organizationId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [turns, brief]);

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    setNotice('');
    setDraft('');
    setTurns((current) => [...current, { role: 'USER', content }]);
    const response = await fetch(`/api/projects/${projectId}/engagement`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(() => null);
    setSending(false);
    const payload = (await response?.json().catch(() => ({}))) as {
      brief?: Brief;
      spoken?: string;
      playbook?: Playbook;
      notice?: string;
      error?: string;
    };
    if (!response?.ok || !payload.brief) {
      // The question goes back in the box: leaving it on screen unanswered
      // would read as if the Lead had taken it in.
      setTurns((current) => current.slice(0, -1));
      setDraft(content);
      setError(payload?.error ?? 'The Lead could not answer.');
      return;
    }
    setTurns((current) => [...current, { role: 'LEAD', content: payload.spoken ?? '' }]);
    setBrief(payload.brief);
    setPlaybook(payload.playbook ?? null);
    if (payload.notice) setNotice(payload.notice);
  }

  async function approve() {
    if (!brief) return;
    setSending(true);
    setError('');
    const response = await fetch(`/api/projects/${projectId}/engagement/approve`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ brief }),
    }).catch(() => null);
    setSending(false);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? 'The brief could not be approved.');
      return;
    }
    setApproved(brief);
    setNotice('Brief approved. It travels with every run on this project from now on.');
    onApproved();
  }

  const shown = brief ?? approved;

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        aria-label={`Brief for ${projectName}`}
        aria-modal="true"
        className="chat-drawer engagement-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="chat-drawer-head">
          <span className="chat-drawer-identity">
            <strong>{lead ? lead.name : 'No Lead on this project'}</strong>
            <small>{lead ? lead.title : 'Put an agent whose role is lead on the project'}</small>
          </span>
          <button
            aria-label="Close the conversation"
            className="drawer-close"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </header>

        <div className="chat-transcript" ref={transcriptRef}>
          {loading && <p className="chat-note">Reading the conversation…</p>}
          {!loading && turns.length === 0 && (
            <p className="chat-note">
              Tell the Lead what you want to happen, in your own words. It will ask until the work
              is clear, and nothing is committed until you approve what it understood.
            </p>
          )}
          {turns.map((turn, index) => (
            <p
              className={
                turn.role === 'USER'
                  ? 'chat-bubble chat-bubble-mine'
                  : 'chat-bubble chat-bubble-theirs'
              }
              key={`${index}-${turn.content.slice(0, 12)}`}
            >
              {turn.content}
            </p>
          ))}
          {sending && <p className="chat-note">The Lead is thinking…</p>}
        </div>

        {shown && (
          <div className="engagement-brief">
            <h4>
              What the Lead understood
              {approved && <span className="engagement-approved">approved</span>}
            </h4>
            <p>{shown.understanding}</p>
            {shown.proposedScope.length > 0 && (
              <>
                <h5>In scope</h5>
                <ul>
                  {shown.proposedScope.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </>
            )}
            {shown.outOfScope.length > 0 && (
              <>
                <h5>Not in scope</h5>
                <ul>
                  {shown.outOfScope.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </>
            )}
            {shown.openPoints.length > 0 && (
              <>
                <h5>Still open</h5>
                <ul>
                  {shown.openPoints.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </>
            )}
            {playbook && (
              <>
                <h5>Way of working: {playbook.name}</h5>
                <ol className="engagement-stages">
                  {playbook.stages.map((stage) => (
                    <li key={stage.key}>
                      {stage.name}
                      <small>
                        {stage.roleKey}
                        {stage.optional ? ' · optional' : ''}
                        {stage.gate === 'HUMAN_APPROVAL' ? ' · you approve it' : ''}
                      </small>
                    </li>
                  ))}
                </ol>
                {playbook.unavailable.length > 0 && (
                  <p className="field-help">
                    Not built yet: {playbook.unavailable.map((entry) => entry.stage).join(', ')}.
                    The studio will stop there and tell you.
                  </p>
                )}
              </>
            )}
            {!approved && (
              <div className="action-row">
                <button
                  className="primary-button"
                  disabled={sending || !brief?.readyForApproval}
                  onClick={() => void approve()}
                  type="button"
                >
                  Approve this brief
                </button>
                {!brief?.readyForApproval && (
                  <small className="field-help">
                    The Lead still has questions. Answer them and it will offer the brief again.
                  </small>
                )}
              </div>
            )}
          </div>
        )}

        {notice && (
          <p className="live-summary chat-drawer-error" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="live-error chat-drawer-error" role="alert">
            {error}
          </p>
        )}

        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Message the Lead"
            disabled={!lead}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={lead ? `Tell ${lead.name} what you need` : 'This project has no Lead yet'}
            rows={2}
            value={draft}
          />
          <button
            className="primary-button"
            disabled={!lead || !draft.trim() || sending}
            type="submit"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </aside>
    </div>
  );
}
