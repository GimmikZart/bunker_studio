'use client';

import { useEffect, useRef, useState } from 'react';
import { apiHeaders } from './live-panel';
import { AgentAvatar, type Agent } from './agent-shared';

type ChatMessage = { role: 'USER' | 'AGENT'; content: string; pending?: boolean };

/**
 * A conversation with one agent, in the shape people already know: who you are
 * talking to at the top, the exchange in the middle with your own messages on
 * the right, and the composer at the bottom. It is a right-hand drawer on a
 * desktop and takes the whole screen on a phone.
 */
export function AgentChatDrawer({
  agent,
  organizationId,
  onClose,
}: {
  agent: Agent;
  organizationId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    void fetch(`/api/agents/${agent.id}/chat`, { headers: apiHeaders(organizationId) })
      .then(async (response) => {
        if (!current) return;
        const payload = (await response.json().catch(() => ({}))) as {
          messages?: { role: 'USER' | 'AGENT'; content: string; sessionId?: string }[];
          error?: string;
        };
        if (!response.ok) {
          setError(payload.error ?? 'The chat history could not be read.');
          return;
        }
        const history = payload.messages ?? [];
        setMessages(history.map(({ role, content }) => ({ role, content })));
        // Continuing the last session keeps the provider's own context instead
        // of starting from nothing on every reopen.
        setSessionId(history[history.length - 1]?.sessionId ?? '');
      })
      .catch(() => {
        if (current) setError('The chat history could not be read.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [agent.id, organizationId]);

  useEffect(() => {
    composerRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, loading]);

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;
    setError('');
    setDraft('');
    setSending(true);
    setMessages((current) => [
      ...current,
      { role: 'USER', content },
      { role: 'AGENT', content: `${agent.name} is thinking…`, pending: true },
    ]);
    const response = await fetch(`/api/agents/${agent.id}/chat`, {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ content, sessionId: sessionId || undefined }),
    }).catch(() => null);
    setSending(false);
    const payload = (await response?.json().catch(() => ({}))) as {
      message?: { content?: string };
      sessionId?: string;
      warning?: string;
      error?: string;
    };
    if (!response?.ok) {
      // The optimistic pair goes away with the failure: leaving a question on
      // screen that was never answered reads as if it had been.
      setMessages((current) => current.filter((message) => !message.pending).slice(0, -1));
      setDraft(content);
      setError(payload?.error ?? 'The agent could not answer.');
      return;
    }
    setSessionId(payload.sessionId ?? sessionId);
    setMessages((current) => [
      ...current.filter((message) => !message.pending),
      { role: 'AGENT', content: payload.message?.content ?? 'No response was returned.' },
    ]);
    if (payload.warning) setError(payload.warning);
  }

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        aria-label={`Chat with ${agent.name}`}
        aria-modal="true"
        className="chat-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="chat-drawer-head">
          <AgentAvatar agent={agent} size="small" />
          <span className="chat-drawer-identity">
            <strong>{agent.name}</strong>
            <small>{agent.title}</small>
          </span>
          <button
            aria-label="Close the chat"
            className="drawer-close"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </header>
        <div className="chat-transcript" ref={transcriptRef}>
          {loading && <p className="chat-note">Loading the conversation…</p>}
          {!loading && messages.length === 0 && (
            <p className="chat-note">
              No messages yet. Anything you send runs through the configured provider, and the
              budget and permission gates still apply.
            </p>
          )}
          {messages.map((message, index) => (
            <p
              className={[
                'chat-bubble',
                message.role === 'USER' ? 'chat-bubble-mine' : 'chat-bubble-theirs',
                message.pending ? 'chat-bubble-pending' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={`${index}-${message.content.slice(0, 12)}`}
            >
              {message.content}
            </p>
          ))}
        </div>
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
            aria-label={`Message ${agent.name}`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={`Message ${agent.name}`}
            ref={composerRef}
            rows={2}
            value={draft}
          />
          <button className="primary-button" disabled={!draft.trim() || sending} type="submit">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </aside>
    </div>
  );
}
