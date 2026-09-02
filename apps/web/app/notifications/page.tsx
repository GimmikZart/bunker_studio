import { NotificationInbox } from '../_components/notification-inbox';

export default function NotificationsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Inbox / Notifications</p>
      <h1>Stay in control while work continues.</h1>
      <p className="hero-copy">
        Approvals, budget limits, quota pauses, security findings and blocked workflows appear here
        with a direct link to the affected work.
      </p>
      <NotificationInbox />
    </main>
  );
}
