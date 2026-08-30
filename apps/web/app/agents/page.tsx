import { LivePanel } from '../_components/live-panel';

export default function AgentsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Agents</p>
      <h1>People who move the work forward.</h1>
      <p className="hero-copy">
        Agent identity, role, provider binding, and performance live here. Create the first agent
        through the onboarding API.
      </p>
      <LivePanel
        resource="agents"
        title="Agent registry"
        description="Identity stays stable while provider bindings can change under owner policy."
      />
    </main>
  );
}
