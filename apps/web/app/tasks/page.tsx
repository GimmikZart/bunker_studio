import { LeadPlannerPanel } from '../_components/lead-planner-panel';
import { TaskBoard } from '../_components/task-board';

export default function TasksPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Tasks</p>
      <h1>Keep work moving.</h1>
      <p className="hero-copy">
        A task is one piece of work handed to one agent. Each moves through clear stages you can
        follow, and waits when it depends on other work, needs your approval, or has checks still to
        pass.
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
