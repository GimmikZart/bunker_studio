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
