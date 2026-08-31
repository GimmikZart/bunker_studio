import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  NotificationPreferences,
  PendingPushNotification,
  PushDeliverySource,
  PushSubscription,
} from '@bunker-studio/notifications';

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object'),
      )
    : [];
}

const defaultPreferences: NotificationPreferences = {
  APPROVAL: true,
  SECURITY: true,
  BUDGET: true,
  QUOTA: true,
  WORKFLOW: true,
};

export function createSupabaseNotificationSource(client: SupabaseClient): PushDeliverySource {
  return {
    async listPending(now) {
      const result = await client
        .from('notifications')
        .select('id,organization_id,user_id,category,severity,title,body,deep_link,read_at')
        .is('push_dispatched_at', null)
        .lte('push_next_attempt_at', now.toISOString())
        .limit(100);
      if (result.error) throw new Error(result.error.message);
      return rows(result.data)
        .filter(
          (item) =>
            typeof item.id === 'string' &&
            typeof item.organization_id === 'string' &&
            typeof item.user_id === 'string' &&
            typeof item.category === 'string' &&
            typeof item.severity === 'string' &&
            typeof item.title === 'string' &&
            typeof item.body === 'string' &&
            typeof item.deep_link === 'string',
        )
        .map((item) => ({
          id: item.id as string,
          organizationId: item.organization_id as string,
          userId: item.user_id as string,
          category: item.category as PendingPushNotification['category'],
          severity: item.severity as PendingPushNotification['severity'],
          title: item.title as string,
          body: item.body as string,
          deepLink: item.deep_link as string,
          readAt: typeof item.read_at === 'string' ? item.read_at : null,
        }));
    },
    async listSubscriptions(userId): Promise<PushSubscription[]> {
      const result = await client
        .from('push_subscriptions')
        .select('endpoint,p256dh,auth')
        .eq('user_id', userId)
        .is('revoked_at', null);
      if (result.error) throw new Error(result.error.message);
      return rows(result.data)
        .filter(
          (item) =>
            typeof item.endpoint === 'string' &&
            typeof item.p256dh === 'string' &&
            typeof item.auth === 'string',
        )
        .map((item) => ({
          endpoint: item.endpoint as string,
          p256dh: item.p256dh as string,
          auth: item.auth as string,
        }));
    },
    async getPreferences(organizationId, userId) {
      const result = await client
        .from('notification_preferences')
        .select('category,enabled')
        .eq('organization_id', organizationId)
        .eq('user_id', userId);
      if (result.error) throw new Error(result.error.message);
      const preferences = { ...defaultPreferences };
      for (const item of rows(result.data)) {
        if (typeof item.category === 'string' && item.category in preferences)
          preferences[item.category as keyof NotificationPreferences] = item.enabled === true;
      }
      return preferences;
    },
    async markDelivered(notificationId, now) {
      const result = await client
        .from('notifications')
        .update({ push_dispatched_at: now.toISOString() })
        .eq('id', notificationId);
      if (result.error) throw new Error(result.error.message);
    },
    async defer(notificationId, nextAttemptAt) {
      const result = await client
        .from('notifications')
        .update({ push_next_attempt_at: nextAttemptAt.toISOString() })
        .eq('id', notificationId);
      if (result.error) throw new Error(result.error.message);
    },
    async revokeSubscription(endpoint) {
      const result = await client
        .from('push_subscriptions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('endpoint', endpoint);
      if (result.error) throw new Error(result.error.message);
    },
  };
}
