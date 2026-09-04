import { LivePanel } from '../_components/live-panel';

export default function ActivityPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Activity</p>
      <h1>A timeline of real work.</h1>
      <p className="hero-copy">
        Events are append-only, correlated, and filterable by agent, team, project, type, and
        severity.
      </p>
      <LivePanel
        resource="activity"
        title="Activity timeline"
        description="Append-only events stay correlated and tenant-scoped as the studio works."
      />
    </main>
  );
}
