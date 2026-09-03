'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiHeaders } from './live-panel';

type Organization = { id: string; name: string };
type Notification = {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  deepLink: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationInbox({ compact = false }: { compact?: boolean }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');

  async function load(id = organizationId) {
    if (!id) return;
    try {
      const response = await fetch('/api/notifications', { headers: apiHeaders(id) });
      if (!response.ok) throw new Error('load');
      setNotifications(
        ((await response.json()) as { notifications?: Notification[] }).notifications ?? [],
      );
      setError('');
    } catch {
      setError('Could not load notifications.');
    }
  }

  useEffect(() => {
    void fetch('/api/organizations', { headers: apiHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error('organizations');
        const values =
          ((await response.json()) as { organizations?: Organization[] }).organizations ?? [];
        setOrganizations(values);
        const saved = window.localStorage.getItem('bunker-organization-id');
        const selected = values.some((item) => item.id === saved) ? saved! : (values[0]?.id ?? '');
        setOrganizationId(selected);
        await load(selected);
      })
      .catch(() => setError('Create an organization to receive notifications.'));
  }, []);

  async function markRead(notificationId: string) {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { ...apiHeaders(organizationId), 'content-type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    if (!response.ok) return setError('Could not update notification.');
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
          : item,
      ),
    );
  }

  function selectOrganization(value: string) {
    setOrganizationId(value);
    window.localStorage.setItem('bunker-organization-id', value);
    void load(value);
  }

  const visible = compact ? notifications.slice(0, 5) : notifications;
  return (
    <section className={compact ? 'notification-popover' : 'live-panel'} aria-label="Notifications">
      {!compact && (
        <div className="live-panel-toolbar">
          <label htmlFor="notification-organization">Organization</label>
          <select
            id="notification-organization"
            value={organizationId}
            onChange={(event) => selectOrganization(event.target.value)}
            disabled={!organizations.length}
          >
            {!organizations.length && (
              <option value="">No organizations — create one in Settings</option>
            )}
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void load()}
            disabled={!organizationId}
          >
            Refresh
          </button>
        </div>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="notification-list" aria-live="polite">
        {!visible.length && !error && <span className="empty-state">No notifications yet.</span>}
        {visible.map((notification) => (
          <article
            className={`notification-record ${notification.readAt ? 'read' : 'unread'}`}
            key={notification.id}
          >
            <div>
              <small>
                {notification.category} · {notification.severity}
              </small>
              <strong>{notification.title}</strong>
              <p>{notification.body}</p>
              <small>{new Date(notification.createdAt).toLocaleString()}</small>
            </div>
            <div className="notification-actions">
              <Link href={notification.deepLink} onClick={() => void markRead(notification.id)}>
                Open
              </Link>
              {!notification.readAt && (
                <button type="button" onClick={() => void markRead(notification.id)}>
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {compact && notifications.length > visible.length && (
        <Link href="/notifications">View all notifications</Link>
      )}
    </section>
  );
}
