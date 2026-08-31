import * as webpush from 'web-push';

export const PACKAGE_NAME = '@bunker-studio/notifications';

export type NotificationCategory = 'APPROVAL' | 'SECURITY' | 'BUDGET' | 'QUOTA' | 'WORKFLOW';
export type Notification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink: string;
  readAt: string | null;
};

export type PendingPushNotification = Notification & {
  userId: string;
  organizationId: string;
  severity: 'LOW' | 'HIGH' | 'CRITICAL';
};

export type NotificationPreferences = Record<NotificationCategory, boolean>;

export function shouldPush(
  category: NotificationCategory,
  severity: 'LOW' | 'HIGH' | 'CRITICAL',
  preferences?: NotificationPreferences,
): boolean {
  return (
    severity !== 'LOW' &&
    ['APPROVAL', 'SECURITY', 'BUDGET', 'QUOTA'].includes(category) &&
    (preferences?.[category] ?? true)
  );
}

export function dedupeKey(notification: Pick<Notification, 'category' | 'deepLink'>): string {
  return `${notification.category}:${notification.deepLink}`;
}

export type PushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushClient = {
  send: (subscription: PushSubscription, payload: string) => Promise<void>;
};

export type VapidPushConfig = {
  subject: string;
  publicKey: string;
  privateKey: string;
  ttlSeconds?: number;
};

/**
 * Server-only Web Push adapter. VAPID material is supplied at runtime and is
 * never part of a subscription or notification payload.
 */
export function createVapidPushClient(
  config: VapidPushConfig,
  sender: typeof webpush.sendNotification = webpush.sendNotification,
): PushClient {
  if (!/^https:\/\//.test(config.subject) && !/^mailto:/i.test(config.subject))
    throw new Error('VAPID subject must be an HTTPS URL or mailto address.');
  if (!config.publicKey.trim() || !config.privateKey.trim())
    throw new Error('VAPID public and private keys are required.');
  const ttlSeconds = config.ttlSeconds ?? 60;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 0) throw new Error('VAPID TTL is invalid.');
  return {
    send: async (subscription, payload) => {
      await sender(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        {
          TTL: ttlSeconds,
          urgency: 'high',
          vapidDetails: {
            subject: config.subject,
            publicKey: config.publicKey,
            privateKey: config.privateKey,
          },
        },
      );
    },
  };
}

export function notificationPayload(notification: Notification): string {
  return JSON.stringify({
    title: notification.title,
    body: notification.body,
    data: { deepLink: notification.deepLink, category: notification.category },
  });
}

export type PushDeliverySource = {
  listPending: (now: Date) => Promise<PendingPushNotification[]>;
  listSubscriptions: (userId: string) => Promise<PushSubscription[]>;
  getPreferences: (organizationId: string, userId: string) => Promise<NotificationPreferences>;
  markDelivered: (notificationId: string, now: Date) => Promise<void>;
  defer: (notificationId: string, nextAttemptAt: Date) => Promise<void>;
  revokeSubscription: (endpoint: string) => Promise<void>;
};

function isExpiredSubscriptionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

export async function dispatchPendingPushNotifications(
  source: PushDeliverySource,
  client: PushClient,
  now = new Date(),
): Promise<{ delivered: number; deferred: number; revoked: number }> {
  const result = { delivered: 0, deferred: 0, revoked: 0 };
  for (const notification of await source.listPending(now)) {
    const preferences = await source.getPreferences(
      notification.organizationId,
      notification.userId,
    );
    if (!shouldPush(notification.category, notification.severity, preferences)) {
      await source.markDelivered(notification.id, now);
      result.delivered += 1;
      continue;
    }
    const subscriptions = await source.listSubscriptions(notification.userId);
    let failed = false;
    for (const subscription of subscriptions) {
      try {
        await client.send(subscription, notificationPayload(notification));
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          await source.revokeSubscription(subscription.endpoint);
          result.revoked += 1;
        } else failed = true;
      }
    }
    if (failed) {
      await source.defer(notification.id, new Date(now.getTime() + 60_000));
      result.deferred += 1;
    } else {
      await source.markDelivered(notification.id, now);
      result.delivered += 1;
    }
  }
  return result;
}

export async function deliverPush(
  client: PushClient,
  subscription: PushSubscription,
  notification: Notification,
  severity: 'LOW' | 'HIGH' | 'CRITICAL',
  preferences?: NotificationPreferences,
): Promise<boolean> {
  if (!shouldPush(notification.category, severity, preferences)) return false;
  await client.send(subscription, notificationPayload(notification));
  return true;
}
