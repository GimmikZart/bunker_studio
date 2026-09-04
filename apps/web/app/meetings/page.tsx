import { MeetingRoomPanel } from '../_components/meeting-room-panel';

export default function MeetingsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Meetings</p>
      <h1>Make decisions together.</h1>
      <p className="hero-copy">
        Bounded, agenda-led meetings turn scoped agent contributions into validated minutes and
        actions.
      </p>
      <MeetingRoomPanel />
    </main>
  );
}
