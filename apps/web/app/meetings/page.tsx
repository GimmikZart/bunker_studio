export default function MeetingsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Meetings</p>
      <h1>Make decisions together.</h1>
      <p className="hero-copy">
        Bounded, agenda-led meetings turn scoped agent contributions into validated minutes and
        actions.
      </p>
      <div className="getting-started">
        <div>
          <h2>Meeting room</h2>
          <p>No active meetings.</p>
        </div>
        <button className="primary-button" type="button">
          Start a meeting
        </button>
      </div>
    </main>
  );
}
