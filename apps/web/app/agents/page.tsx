import { AgentCrudPanel } from '../_components/agent-crud-panel';
import { AgentDetailPanel } from '../_components/agent-detail-panel';

export default function AgentsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Agents</p>
      <h1>People who move the work forward.</h1>
      <p className="hero-copy">
        Agent identity, role, provider binding, and performance live here. Provider credentials stay
        server-side while authorized organization owners manage the registry.
      </p>
      <AgentDetailPanel />
      <AgentCrudPanel />
    </main>
  );
}
