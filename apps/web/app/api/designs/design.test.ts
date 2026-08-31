import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as submitDesign } from './route';
import { POST as approveDesign } from './[versionId]/approve/route';
import { POST as resolveDesign } from './[versionId]/resolve/route';

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

  it('supports owner reject and request-changes decisions', async () => {
    const owner = `design-resolution-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organization = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `Design resolution ${owner}` }),
      }),
    );
    const organizationId = (await organization.json()).organization.id;
    const submit = async (versionNumber: number) => {
      const response = await submitDesign(
        new Request('http://localhost/api/designs', {
          method: 'POST',
          headers: { ...headers, 'x-bunker-organization-id': organizationId },
          body: JSON.stringify({
            versionNumber,
            status: 'SUBMITTED',
            spec: { screen: `v${versionNumber}` },
            rationale: 'test',
            previewArtifactIds: [],
          }),
        }),
      );
      return (await response.json()).version;
    };
    const rejected = await submit(1);
    const rejectResponse = await resolveDesign(
      new Request('http://localhost/api/designs/resolve', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({ decision: 'REJECTED' }),
      }),
      { params: Promise.resolve({ versionId: rejected.id }) },
    );
    expect((await rejectResponse.json()).versions[0].status).toBe('REJECTED');

    const changes = await submit(2);
    const changesResponse = await resolveDesign(
      new Request('http://localhost/api/designs/resolve', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({ decision: 'CHANGES' }),
      }),
      { params: Promise.resolve({ versionId: changes.id }) },
    );
    expect(
      (await changesResponse.json()).versions.find(
        (version: { id: string }) => version.id === changes.id,
      ).status,
    ).toBe('DRAFT');
  });
});
