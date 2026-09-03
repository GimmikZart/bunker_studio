import Link from 'next/link';
import { OfficeDashboard } from './_components/office-dashboard';

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero" id="office">
        <div>
          <p className="eyebrow">Organization / Bunker Studio</p>
          <h1>Your studio at a glance.</h1>
          <p className="hero-copy">
            A calm command center for durable AI teams, active work, and the decisions that need
            you.
          </p>
        </div>
        <div className="status-card" aria-label="Studio status">
          <span className="status-pulse" aria-hidden="true" />
          <div>
            <strong>Studio is ready</strong>
            <span>All systems operational</span>
          </div>
        </div>
      </section>

      <OfficeDashboard />

      <section className="getting-started">
        <div>
          <p className="eyebrow">Getting started</p>
          <h2>Build the team around the work.</h2>
          <p>
            Once the organization exists, connect a provider in Settings, then create a project and
            hire the team.
          </p>
        </div>
        <div className="action-row">
          <Link className="primary-button" href="/projects">
            Create project
          </Link>
          <Link className="secondary-button" href="/settings">
            Connect a provider
          </Link>
        </div>
      </section>
    </main>
  );
}
