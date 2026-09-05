import { AgentDirectory } from '../_components/agent-directory';

export default function AgentsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Agents</p>
      <h1>People who move the work forward.</h1>
      <p className="hero-copy">
        Your studio members. Each keeps its own name, role and memory, and you choose which AI it
        runs on. Change the AI whenever you like: the agent and everything it has learned stay the
        same. API keys never leave the server.
      </p>
      <AgentDirectory />
    </main>
  );
}
