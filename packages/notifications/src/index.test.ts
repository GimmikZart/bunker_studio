import { describe, expect, it } from 'vitest';
import {
  createVapidPushClient,
  dedupeKey,
  deliverPush,
  dispatchPendingPushNotifications,
  shouldPush,
} from './index';

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

  it('deduplicates pending delivery, defers transient failures and revokes expired subscriptions', async () => {
    const delivered: string[] = [];
    const deferred: string[] = [];
    const revoked: string[] = [];
    const source = {
      listPending: async () => [
        {
          id: 'n1',
          userId: 'u1',
          organizationId: 'o1',
          category: 'APPROVAL' as const,
          severity: 'HIGH' as const,
          title: 'Approve',
          body: 'Review',
          deepLink: '/approvals/1',
          readAt: null,
        },
        {
          id: 'n2',
          userId: 'u1',
          organizationId: 'o1',
          category: 'SECURITY' as const,
          severity: 'CRITICAL' as const,
          title: 'Security',
          body: 'Check',
          deepLink: '/activity',
          readAt: null,
        },
      ],
      listSubscriptions: async () => [
        { endpoint: 'https://expired', p256dh: 'key', auth: 'auth' },
        { endpoint: 'https://transient', p256dh: 'key', auth: 'auth' },
      ],
      getPreferences: async () => ({
        APPROVAL: true,
        SECURITY: true,
        BUDGET: true,
        QUOTA: true,
        WORKFLOW: true,
      }),
      markDelivered: async (id: string) => {
        delivered.push(id);
      },
      defer: async (id: string) => {
        deferred.push(id);
      },
      revokeSubscription: async (endpoint: string) => {
        revoked.push(endpoint);
      },
    };
    const sent = await dispatchPendingPushNotifications(
      source,
      {
        send: async (subscription) => {
          if (subscription.endpoint === 'https://expired') throw { statusCode: 410 };
          if (subscription.endpoint === 'https://transient') throw new Error('temporary');
        },
      },
      new Date(0),
    );
    expect(sent).toEqual({ delivered: 0, deferred: 2, revoked: 2 });
    expect(delivered).toEqual([]);
    expect(deferred).toEqual(['n1', 'n2']);
    expect(revoked).toEqual(['https://expired', 'https://expired']);
  });
});
