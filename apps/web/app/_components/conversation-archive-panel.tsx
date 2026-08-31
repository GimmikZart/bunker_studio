'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Conversation = {
  id: string;
  agentId: string;
  externalSessionId: string;
  messages: string[];
};

export function ConversationArchivePanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(nextOrganizationId = organizationId, nextQuery = query) {
    if (!nextOrganizationId) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '20' });
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    const response = await fetch(`/api/conversations?${params.toString()}`, {
      headers: apiHeaders(nextOrganizationId),
    });
    if (!response.ok) {
      setError('Could not load the conversation archive.');
      setLoading(false);
      return;
    }
    setConversations(
      ((await response.json()) as { conversations?: Conversation[] }).conversations ?? [],
    );
    setLoading(false);
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organization');
        const next =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(next);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = next.some((item) => item.id === saved) ? saved! : (next[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected, '');
      })
      .catch(() => setError('Create or select an organization to load the archive.'));
  }, []);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    void load(value);
  }

  return (
    <section className="live-panel" aria-label="Conversation archive">
      <div className="live-panel-toolbar">
        <label htmlFor="conversation-organization">Organization</label>
        <select
          id="conversation-organization"
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
      <div className="getting-started live-panel-card">
        <div>
          <h2>Conversation archive</h2>
          <p>Search historical messages without injecting the archive into agent context.</p>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <label htmlFor="conversation-search">Search messages</label>
            <input
              id="conversation-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. deployment decision"
            />
            <button className="primary-button" type="submit" disabled={loading || !organizationId}>
              Search
            </button>
          </form>
          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="live-records">
          {!loading && conversations.length === 0 && !error && (
            <span className="empty-state">No matching conversations.</span>
          )}
          {conversations.map((conversation) => (
            <article className="live-record" key={conversation.id}>
              <span>
                <strong>{conversation.externalSessionId || 'Conversation'}</strong>
                <small>{conversation.agentId}</small>
                <small>{conversation.messages.join(' · ')}</small>
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
