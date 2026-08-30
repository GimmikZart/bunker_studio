import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('virgin template export', () => {
  it('contains infrastructure defaults without tenant data or secrets', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const template = await response.json();
    expect(template.manifest.kind).toBe('VIRGIN_TEMPLATE');
    expect(template.agentTemplates.length).toBeGreaterThan(0);
    expect(template.data.organizations).toEqual([]);
    expect(template.data.secrets).toEqual([]);
    expect(JSON.stringify(template)).not.toMatch(/api[_-]?key|refresh[_-]?token|master[_-]?key/i);
  });
});
