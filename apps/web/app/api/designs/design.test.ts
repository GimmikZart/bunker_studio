import { afterEach, describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { POST as createAgent } from '../agents/route';
import { GET as listDesigns, POST as submitDesign } from './route';
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

  it('creates one to three bounded static previews for a designer request', async () => {
    const owner = `designer-preview-owner-${crypto.randomUUID()}`;
    const headers = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
    const organization = await createOrganization(
      new Request('http://localhost', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `Designer previews ${owner}` }),
      }),
    );
    const organizationId = (await organization.json()).organization.id;
    const response = await submitDesign(
      new Request('http://localhost/api/designs', {
        method: 'POST',
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
        body: JSON.stringify({
          designerAgentId: crypto.randomUUID(),
          brief: '<script>must not execute</script> Home dashboard',
          constraints: ['Keyboard navigation'],
          variantCount: 2,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const created = (await response.json()).versions;
    expect(created).toHaveLength(2);
    expect(created[0].previewArtifactIds).toHaveLength(1);
    expect(created[0].designRequestId).toBe(created[1].designRequestId);

    const listed = await listDesigns(
      new Request('http://localhost/api/designs', {
        headers: { ...headers, 'x-bunker-organization-id': organizationId },
      }),
    );
    const first = (await listed.json()).versions[0];
    expect(first.previews[0].html).toContain('&lt;script&gt;must not execute&lt;/script&gt;');
    expect(first.previews[0].html).not.toContain('<script>');
  });
});

afterEach(() => {
  delete process.env.BUNKER_FAKE_RUNTIME_RESPONSE;
});

async function designerStudio() {
  const owner = `designer-${crypto.randomUUID()}`;
  const baseHeaders = { 'content-type': 'application/json', 'x-bunker-user-id': owner };
  const organizationId = (
    await (
      await createOrganization(
        new Request('http://localhost', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ name: `Designer studio ${owner}` }),
        }),
      )
    ).json()
  ).organization.id;
  const headers = { ...baseHeaders, 'x-bunker-organization-id': organizationId };
  const designerAgentId = (
    await (
      await createAgent(
        new Request('http://localhost', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'Iris',
            roleKey: 'designer',
            title: 'Product Designer',
            providerConnectionId: '00000000-0000-4000-8000-000000000002',
            providerModelId: 'fake-default',
            runtimeType: 'OPENAI_COMPATIBLE',
          }),
        }),
      )
    ).json()
  ).agent.id;
  return { headers, designerAgentId };
}

async function propose(headers: Record<string, string>, designerAgentId: string) {
  const response = await submitDesign(
    new Request('http://localhost/api/designs', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        designerAgentId,
        brief: 'Home dashboard for long-running work',
        constraints: [],
        variantCount: 1,
      }),
    }),
  );
  expect(response.status).toBe(201);
  const listed = await listDesigns(new Request('http://localhost/api/designs', { headers }));
  return (await listed.json()).versions.at(-1);
}

describe('provider-backed designer', () => {
  it("renders the Designer's structured draft", async () => {
    const { headers, designerAgentId } = await designerStudio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify({
      variants: [
        {
          title: 'Focused workspace',
          rationale: 'Puts the primary action first.',
          headline: 'Track every run',
          summary: 'A calm board that surfaces what needs a decision.',
          accentColor: '#0f766e',
          surfaceColor: '#f0fdfa',
          primaryAction: 'Start a run',
          sections: [{ heading: 'Board', body: 'Tasks grouped by state.' }],
          mainStates: ['default', 'empty'],
        },
      ],
    });
    const version = await propose(headers, designerAgentId);
    expect(version.spec.source).toBe('DESIGNER_AGENT');
    expect(version.rationale).toBe('Puts the primary action first.');
    expect(version.previews[0].html).toContain('Track every run');
    expect(version.previews[0].html).toContain('#0f766e');
  });

  it('escapes the draft instead of trusting it as markup', async () => {
    const { headers, designerAgentId } = await designerStudio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify({
      variants: [
        {
          title: 'Injected',
          rationale: 'Attempts to inject markup.',
          headline: '<script>alert(1)</script>',
          summary: 'Safe.',
          accentColor: '#7c3aed',
          surfaceColor: '#f5f3ff',
          primaryAction: 'Go',
          sections: [],
          mainStates: [],
        },
      ],
    });
    const version = await propose(headers, designerAgentId);
    expect(version.previews[0].html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(version.previews[0].html).not.toContain('<script>');
  });

  it('falls back to the deterministic generator when the draft is unusable', async () => {
    const { headers, designerAgentId } = await designerStudio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = 'I would use a calm two-column layout.';
    const version = await propose(headers, designerAgentId);
    expect(version.spec.source).toBeUndefined();
    expect(version.previews[0].html).toContain('Bunker Studio design preview');
  });

  it('falls back when a colour is not a plain hex value', async () => {
    const { headers, designerAgentId } = await designerStudio();
    process.env.BUNKER_FAKE_RUNTIME_RESPONSE = JSON.stringify({
      variants: [
        {
          title: 'Injected colour',
          rationale: 'Attempts CSS injection.',
          headline: 'Headline',
          summary: 'Safe.',
          accentColor: 'red;}body{display:none',
          surfaceColor: '#f5f3ff',
          primaryAction: 'Go',
          sections: [],
          mainStates: [],
        },
      ],
    });
    const version = await propose(headers, designerAgentId);
    expect(version.spec.source).toBeUndefined();
    expect(version.previews[0].html).not.toContain('display:none');
  });
});
