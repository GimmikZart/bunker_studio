import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as studioLabs } from './route';
import { POST as protectedMerge } from './merge/route';

describe('Studio Labs control plane', () => {
  it('initializes protected core, analyzes deterministic signals and creates gated work', async () => {
    const owner = `labs-owner-${crypto.randomUUID()}`;
    const headers = {
      'content-type': 'application/json',
      'x-bunker-user-id': owner,
    };
    const organizationResponse = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Labs Workspace' }),
      }),
    );
    const organizationId = (await organizationResponse.json()).organization.id;
    const scopedHeaders = { ...headers, 'x-bunker-organization-id': organizationId };
    const initialized = await studioLabs(
      new Request('http://localhost', {
        method: 'POST',
        headers: scopedHeaders,
        body: JSON.stringify({ action: 'INITIALIZE' }),
      }),
    );
    expect(initialized.status).toBe(201);
    const project = (await initialized.json()).project;
    expect(project.isStudioCore).toBe(true);

    const analysis = await studioLabs(
      new Request('http://localhost', {
        method: 'POST',
        headers: scopedHeaders,
        body: JSON.stringify({ action: 'ANALYZE' }),
      }),
    );
    expect(analysis.status).toBe(200);
    const analysisPayload = await analysis.json();
    expect(analysisPayload.snapshot).toMatchObject({ completedTasks: 0, activityEvents: 1 });
    expect(analysisPayload.proposals.length).toBeGreaterThan(0);

    const selected = await studioLabs(
      new Request('http://localhost', {
        method: 'POST',
        headers: scopedHeaders,
        body: JSON.stringify({
          action: 'SELECT',
          projectId: project.id,
          proposalId: analysisPayload.proposals[0].id,
        }),
      }),
    );
    expect(selected.status).toBe(201);
    const selectedPayload = await selected.json();
    expect(selectedPayload).toMatchObject({
      task: { projectId: project.id, state: 'DRAFT' },
      approval: { approvalType: 'STUDIO_CORE_MERGE', status: 'PENDING', risk: 'CRITICAL' },
      policy: { approvalRequired: true },
    });
    const merge = await protectedMerge(
      new Request('http://localhost', {
        method: 'POST',
        headers: scopedHeaders,
        body: JSON.stringify({ taskId: selectedPayload.task.id }),
      }),
    );
    expect(merge.status).toBe(409);
    expect(await merge.json()).toMatchObject({
      gate: { allowed: false, missing: ['REVIEWER', 'CI', 'OWNER_APPROVAL'] },
    });
  });
});
