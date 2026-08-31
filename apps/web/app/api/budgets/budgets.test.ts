import { describe, expect, it } from 'vitest';
import { POST as createOrganization } from '../organizations/route';
import { GET as listPolicies, POST as createPolicy } from './policies/route';
import { DELETE as deletePolicy, PATCH as updatePolicy } from './policies/[policyId]/route';
import { GET as getReport, PUT as saveReport } from './report/route';

async function organization() {
  const userId = `budget-owner-${crypto.randomUUID()}`;
  const headers = { 'content-type': 'application/json', 'x-bunker-user-id': userId };
  const response = await createOrganization(
    new Request('http://localhost/api/organizations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Budget Studio' }),
    }),
  );
  const payload = await response.json();
  return { userId, organizationId: payload.organization.id as string, headers };
}

describe('budget policy and report routes', () => {
  it('allows owners to create, update, list and delete a policy', async () => {
    const { userId, organizationId, headers } = await organization();
    const scopedHeaders = { ...headers, 'x-bunker-organization-id': organizationId };
    const created = await createPolicy(
      new Request('http://localhost/api/budgets/policies', {
        method: 'POST',
        headers: scopedHeaders,
        body: JSON.stringify({
          periodType: 'MONTHLY',
          softLimit: 50,
          hardLimit: 100,
          currency: 'USD',
          actionOnSoft: 'NOTIFY',
          actionOnHard: 'BLOCK',
          escalationThreshold: 2,
          allowProviderFallback: false,
          enabled: true,
        }),
      }),
    );
    const createdPayload = await created.json();
    expect(created.status).toBe(201);
    const policy = createdPayload.policy;
    const listed = await listPolicies(
      new Request('http://localhost/api/budgets/policies', { headers: scopedHeaders }),
    );
    expect(listed.status).toBe(200);
    expect((await listed.json()).policies).toHaveLength(1);
    const updated = await updatePolicy(
      new Request(`http://localhost/api/budgets/policies/${policy.id}`, {
        method: 'PATCH',
        headers: scopedHeaders,
        body: JSON.stringify({ hardLimit: 200 }),
      }),
      { params: Promise.resolve({ policyId: policy.id }) },
    );
    if (!updated) throw new Error('Expected update response.');
    expect(updated.status).toBe(200);
    expect((await updated.json()).policy.hardLimit).toBe(200);
    const deleted = await deletePolicy(
      new Request(`http://localhost/api/budgets/policies/${policy.id}`, {
        method: 'DELETE',
        headers: scopedHeaders,
      }),
      { params: Promise.resolve({ policyId: policy.id }) },
    );
    if (!deleted) throw new Error('Expected delete response.');
    expect(deleted.status).toBe(204);
    expect(userId).toContain('budget-owner-');
  });

  it('persists a weekly report schedule and returns cost summaries', async () => {
    const { organizationId, headers } = await organization();
    const scopedHeaders = { ...headers, 'x-bunker-organization-id': organizationId };
    const saved = await saveReport(
      new Request('http://localhost/api/budgets/report', {
        method: 'PUT',
        headers: scopedHeaders,
        body: JSON.stringify({
          frequency: 'WEEKLY',
          dayOfWeek: 1,
          hourUtc: 9,
          minuteUtc: 30,
          timezone: 'Europe/Rome',
          recipients: ['owner@example.com'],
          enabled: true,
        }),
      }),
    );
    if (!saved) throw new Error('Expected save response.');
    expect(saved.status).toBe(200);
    const report = await getReport(
      new Request('http://localhost/api/budgets/report', { headers: scopedHeaders }),
    );
    if (!report) throw new Error('Expected report response.');
    expect(report.status).toBe(200);
    const payload = await report.json();
    expect(payload.schedule.timezone).toBe('Europe/Rome');
    expect(payload.reports).toEqual([]);
  });

  it('rejects unauthenticated policy access', async () => {
    const response = await listPolicies(new Request('http://localhost/api/budgets/policies'));
    expect(response.status).toBe(401);
  });
});
