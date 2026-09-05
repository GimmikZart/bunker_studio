import { AgentCrudPanel } from '../../_components/agent-crud-panel';

export default function NewAgentPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Agents / New</p>
      <h1>Hire a new agent.</h1>
      <p className="hero-copy">
        A template fills in a safe role, skills, tools and permissions; you supply the name and
        choose which AI account and model it runs on. Everything here can be changed later from the
        agent&rsquo;s own card.
      </p>
      <AgentCrudPanel />
    </main>
  );
}
