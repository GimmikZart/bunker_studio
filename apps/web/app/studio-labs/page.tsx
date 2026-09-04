import { StudioLabsPanel } from '../_components/studio-labs-panel';

export default function StudioLabsPage() {
  return (
    <main className="shell content-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <div className="brand-mark">
          <span className="brand-dot" aria-hidden="true" />
          <span>Bunker Studio</span>
        </div>
        <div className="nav-links">
          <a href="/">Office</a>
          <a href="/agents">Agents</a>
          <a className="active" href="/studio-labs">
            Studio Labs
          </a>
          <a href="/approvals">Approvals</a>
          <a href="/activity">Activity</a>
          <a href="/settings">Settings</a>
        </div>
      </nav>
      <p className="eyebrow">Bunker Studio / Labs</p>
      <h1>Improve the studio under guardrails.</h1>
      <p className="hero-copy">
        Every proposal becomes reviewed work. Production deployment is never part of this flow.
      </p>
      <StudioLabsPanel />
    </main>
  );
}
