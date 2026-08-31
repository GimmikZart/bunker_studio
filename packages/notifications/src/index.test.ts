import { describe, expect, it } from 'vitest';
import { createVapidPushClient, dedupeKey, deliverPush, shouldPush } from './index';

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

  it('passes subscriptions and runtime VAPID configuration to the Web Push adapter', async () => {
    let received: { subscription: unknown; payload: string; options: unknown } | undefined;
    const client = createVapidPushClient(
      {
        subject: 'mailto:security@example.test',
        publicKey: 'public-key',
        privateKey: 'private-key',
      },
      async (subscription, body, options) => {
        received = { subscription, payload: String(body), options };
        return { statusCode: 201, body: '', headers: {} };
      },
    );
    await client.send(
      { endpoint: 'https://push.example', p256dh: 'key', auth: 'auth' },
      '{"ok":true}',
    );
    expect(received).toMatchObject({
      subscription: {
        endpoint: 'https://push.example',
        keys: { p256dh: 'key', auth: 'auth' },
      },
      payload: '{"ok":true}',
      options: {
        TTL: 60,
        urgency: 'high',
        vapidDetails: {
          subject: 'mailto:security@example.test',
          publicKey: 'public-key',
          privateKey: 'private-key',
        },
      },
    });
  });
});
