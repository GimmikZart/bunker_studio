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
