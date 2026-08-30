import { describe, expect, it } from 'vitest';
import { dedupeKey, deliverPush, shouldPush } from './index';

describe('notification policy', () => {
  it('pushes only critical categories and deduplicates by deep link', () => {
    expect(shouldPush('APPROVAL', 'HIGH')).toBe(true);
    expect(
      shouldPush('APPROVAL', 'HIGH', {
        APPROVAL: false,
        SECURITY: true,
        BUDGET: true,
        QUOTA: true,
        WORKFLOW: true,
      }),
    ).toBe(false);
    expect(shouldPush('WORKFLOW', 'HIGH')).toBe(false);
    expect(dedupeKey({ category: 'APPROVAL', deepLink: '/approvals/1' })).toBe(
      'APPROVAL:/approvals/1',
    );
  });

  it('delivers a deep-link payload through the provider-neutral push adapter', async () => {
    let payload = '';
    const sent = await deliverPush(
      {
        send: async (_subscription, body) => {
          payload = body;
        },
      },
      { endpoint: 'https://push.example', p256dh: 'key', auth: 'auth' },
      {
        id: 'n1',
        category: 'APPROVAL',
        title: 'Approve',
        body: 'Review',
        deepLink: '/approvals/1',
        readAt: null,
      },
      'HIGH',
    );
    expect(sent).toBe(true);
    expect(JSON.parse(payload).data.deepLink).toBe('/approvals/1');
  });
});
