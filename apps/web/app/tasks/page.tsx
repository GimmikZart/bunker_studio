import { TaskBoard } from '../_components/task-board';

export default function TasksPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Tasks</p>
      <h1>Keep work moving.</h1>
      <p className="hero-copy">
        Tasks move through an auditable state machine and wait for dependencies, approvals, quota,
        and verification when required.
      </p>
      <TaskBoard />
    </main>
  );
}
