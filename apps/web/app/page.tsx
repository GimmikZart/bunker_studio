const areas = [
  { label: 'Lead', detail: 'Planning', tone: 'violet' },
  { label: 'Development', detail: 'Ready for work', tone: 'blue' },
  { label: 'Design', detail: 'No active proposal', tone: 'amber' },
  { label: 'Review / QA', detail: 'Verification idle', tone: 'green' },
];

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="topbar" aria-label="Primary navigation">
        <div className="brand-mark">
          <span className="brand-dot" aria-hidden="true" />
          <span>Bunker Studio</span>
        </div>
        <div className="nav-links">
          <a className="active" href="/">
            Office
          </a>
          <a href="#projects">Projects</a>
          <a href="/agents">Agents</a>
          <a href="/approvals">Approvals</a>
          <a href="/meetings">Meetings</a>
          <a href="/costs">Costs</a>
          <a href="/activity">Activity</a>
          <a href="/settings">Settings</a>
        </div>
        <button className="avatar-button" type="button" aria-label="Open account menu">
          GM
        </button>
      </nav>

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

      <section className="office-grid" aria-label="Office areas">
        {areas.map((area) => (
          <article className={`office-area ${area.tone}`} key={area.label}>
            <div className="area-heading">
              <span className="area-icon" aria-hidden="true" />
              <span>{area.label}</span>
            </div>
            <p>{area.detail}</p>
            <div className="empty-state">No agents assigned yet</div>
          </article>
        ))}
        <article className="meeting-area">
          <div className="area-heading">
            <span className="area-icon" aria-hidden="true" />
            Meeting room
          </div>
          <p>Quiet until needed</p>
          <button className="secondary-button" type="button">
            Start a meeting
          </button>
        </article>
      </section>

      <section className="getting-started" id="projects">
        <div>
          <p className="eyebrow">Getting started</p>
          <h2>Build the team around the work.</h2>
          <p>Create your first project, connect a repository, or invite an agent to begin.</p>
        </div>
        <div className="action-row">
          <button className="primary-button" type="button">
            Create project
          </button>
          <button className="secondary-button" type="button">
            Add an agent
          </button>
        </div>
      </section>
    </main>
  );
}
