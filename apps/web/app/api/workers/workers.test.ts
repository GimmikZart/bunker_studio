import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as registerWorker } from './register/route';
import { DELETE } from './[workerId]/route';

describe('worker administration', () => {
  it('allows an owner to revoke a local worker credential', async () => {
    const userId = `worker-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
    const organization = await createOrganization(
      new Request('http://localhost/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Worker Control' }),
      }),
    );
    const organizationId = (await organization.json()).organization.id as string;
    const scopedHeaders = { ...headers, 'x-bunker-organization-id': organizationId };
    const registered = await registerWorker(
      new Request('http://localhost/api/workers/register', {
        method: 'POST',
        headers: scopedHeaders,
        body: JSON.stringify({
          name: 'Test PC',
          capabilities: ['chat', 'codex'],
          allowedScopes: ['apps'],
          maxConcurrent: 1,
        }),
      }),
    );
    expect(registered.status).toBe(201);
    const workerId = (await registered.json()).worker.id as string;
    const revoked = await DELETE(
      new Request(`http://localhost/api/workers/${workerId}`, {
        method: 'DELETE',
        headers: scopedHeaders,
      }),
      { params: Promise.resolve({ workerId }) },
    );
    expect(revoked.status).toBe(200);
    expect((await revoked.json()).worker.status).toBe('REVOKED');
  });
});
