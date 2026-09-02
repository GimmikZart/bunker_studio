'use client';
import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';
type Organization = { id: string; name: string };
type Memory = { id: string; content: string; type: string; importance: number; source?: string };
export function MemoryPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]),
    [organizationId, setOrganizationId] = useState(''),
    [content, setContent] = useState(''),
    [type, setType] = useState('DECISION'),
    [importance, setImportance] = useState(50),
    [query, setQuery] = useState(''),
    [memories, setMemories] = useState<Memory[]>([]),
    [error, setError] = useState('');
  async function load(id = organizationId, q = query) {
    if (!id) return;
    const response = await fetch(`/api/memories${q ? `?query=${encodeURIComponent(q)}` : ''}`, {
      headers: apiHeaders(id),
    });
    if (!response.ok) return setError('Could not load memories.');
    setMemories(((await response.json()) as { memories?: Memory[] }).memories ?? []);
  }
  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() }).then(async (r) => {
      const values = ((await r.json()) as { organizations?: Organization[] }).organizations ?? [];
      setOrganizations(values);
      const id = values[0]?.id ?? '';
      setOrganizationId(id);
      await load(id, '');
    });
  }, []);
  async function add() {
    if (!content.trim() || !organizationId) return;
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
      <div className="resource-form">
        <label htmlFor="memory-content">Memory</label>
        <textarea
          id="memory-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <label htmlFor="memory-type">Type</label>
        <select id="memory-type" value={type} onChange={(e) => setType(e.target.value)}>
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
          onChange={(e) => setImportance(Number(e.target.value))}
        />
        <button className="primary-button" type="button" onClick={() => void add()}>
          Save memory
        </button>
        <label htmlFor="memory-search">Search memories</label>
        <input id="memory-search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="secondary-button" type="button" onClick={() => void load()}>
          Search
        </button>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="live-records">
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
