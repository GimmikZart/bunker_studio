'use client';

import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Memory = { id: string; content: string; type: string; importance: number; source?: string };

export function MemoryPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('DECISION');
  const [importance, setImportance] = useState(50);
  const [query, setQuery] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(id = organizationId, q = query) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/memories${q ? `?query=${encodeURIComponent(q)}` : ''}`, {
        headers: apiHeaders(id),
      });
      if (!response.ok) throw new Error('load');
      setMemories(((await response.json()) as { memories?: Memory[] }).memories ?? []);
    } catch {
      setError('Could not load memories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organization');
        const values =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(values);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = values.some((item) => item.id === saved) ? saved! : (values[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected, '');
      })
      .catch(() => setError('Create or select an organization to manage memory.'));
  }, []);

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    void load(value, '');
  }

  async function add() {
    if (!content.trim() || !organizationId) return;
    setError('');
    const response = await fetch('/api/memories', {
      method: 'POST',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ content, type, importance }),
    });
    if (!response.ok) return setError('Could not save memory.');
    setContent('');
    await load();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/memories?memoryId=${id}`, {
      method: 'DELETE',
      headers: apiHeaders(organizationId),
    });
    if (!response.ok) return setError('Could not remove memory.');
    await load();
  }

  return (
    <section className="live-panel" aria-label="Structured memory">
      <div className="live-panel-toolbar">
        <label htmlFor="memory-organization">Organization</label>
        <select
          id="memory-organization"
          value={organizationId}
          onChange={(event) => selectOrganization(event.target.value)}
          disabled={!organizations.length}
        >
          {!organizations.length && (
            <option value="">No organizations — create one in Settings</option>
          )}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
      <div className="resource-form">
        <label htmlFor="memory-content">Memory</label>
        <textarea
          id="memory-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
        />
        <label htmlFor="memory-type">Type</label>
        <select id="memory-type" value={type} onChange={(event) => setType(event.target.value)}>
          <option>DECISION</option>
          <option>PROJECT_KNOWLEDGE</option>
          <option>LESSON</option>
          <option>PINNED</option>
        </select>
        <label htmlFor="memory-importance">Importance</label>
        <input
          id="memory-importance"
          type="number"
          min="0"
          max="100"
          value={importance}
          onChange={(event) => setImportance(Number(event.target.value))}
        />
        <button
          className="primary-button"
          type="button"
          disabled={!organizationId || !content.trim() || loading}
          onClick={() => void add()}
        >
          Save memory
        </button>
        <label htmlFor="memory-search">Search memories</label>
        <input
          id="memory-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="secondary-button"
          type="button"
          disabled={!organizationId || loading}
          onClick={() => void load()}
        >
          Search
        </button>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="live-records">
        {!loading && memories.length === 0 && !error && (
          <span className="empty-state">No matching memories.</span>
        )}
        {memories.map((memory) => (
          <article className="live-record" key={memory.id}>
            <strong>
              {memory.type} · {memory.importance}
            </strong>
            <p>{memory.content}</p>
            <small>{memory.source ?? `memory:${memory.id}`}</small>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void remove(memory.id)}
            >
              Remove
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
