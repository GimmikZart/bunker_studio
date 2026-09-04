import { MeetingRoomPanel } from '../_components/meeting-room-panel';

export default function MeetingsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Meetings</p>
      <h1>Make decisions together.</h1>
      <p className="hero-copy">
        Put several agents around an agenda and let them respond to each other, for a set number of
        rounds so the cost stays predictable. You get minutes with the decisions actually reached.
      </p>
      <MeetingRoomPanel />
    </main>
  );
}
