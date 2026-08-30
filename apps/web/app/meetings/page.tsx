import { LivePanel } from '../_components/live-panel';

export default function MeetingsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Meetings</p>
      <h1>Make decisions together.</h1>
      <p className="hero-copy">
        Bounded, agenda-led meetings turn scoped agent contributions into validated minutes and
        actions.
      </p>
      <LivePanel
        resource="meetings"
        title="Meeting room"
        description="Agenda-led meetings produce bounded contributions and persisted minutes."
      />
    </main>
  );
}
