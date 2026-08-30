export default function AgentsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Agents</p>
      <h1>People who move the work forward.</h1>
      <p className="hero-copy">
        Agent identity, role, provider binding, and performance live here. Create the first agent
        through the onboarding API.
      </p>
      <div className="getting-started">
        <div>
          <h2>Agent registry</h2>
          <p>No active agents yet.</p>
        </div>
        <a className="primary-button" href="/onboarding">
          Create agent
        </a>
      </div>
    </main>
  );
}
