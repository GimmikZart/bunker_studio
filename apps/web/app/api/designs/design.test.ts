import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as submitDesign } from './route';
import { POST as approveDesign } from './[versionId]/approve/route';

describe('design gate API', () => {
  it('keeps a submitted version pending until the owner approves it', async () => {
    const owner = `design-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organization = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `Design ${owner}` }),
      }),
    );
    const organizationId = (await organization.json()).organization.id;
    const submitted = await submitDesign(
      new Request('http://localhost/api/designs', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({
          versionNumber: 1,
          status: 'SUBMITTED',
          spec: { screen: 'home' },
          rationale: 'test',
          previewArtifactIds: [],
        }),
      }),
    );
    const version = (await submitted.json()).version;
    expect(version.status).toBe('SUBMITTED');
    const approved = await approveDesign(
      new Request('http://localhost/api/designs/approve', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
      { params: Promise.resolve({ versionId: version.id }) },
    );
    expect((await approved.json()).versions[0].status).toBe('APPROVED');
  });
});
