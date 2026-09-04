import { LeadPlannerPanel } from '../_components/lead-planner-panel';
import { TaskBoard } from '../_components/task-board';

export default function TasksPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Tasks</p>
      <h1>Keep work moving.</h1>
      <p className="hero-copy">
        Tasks move through an auditable state machine and wait for dependencies, approvals, quota,
        and verification when required.
      </p>
      <h2>Ask the Lead to plan</h2>
      <p className="hero-copy">
        Describe the outcome. The Lead proposes a decomposition, the studio checks it against your
        rules, and nothing is created until you accept it.
      </p>
      <LeadPlannerPanel />
      <h2>Board</h2>
      <TaskBoard />
    </main>
  );
}
