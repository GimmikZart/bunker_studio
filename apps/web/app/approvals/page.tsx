import { LivePanel } from '../_components/live-panel';

export default function ApprovalsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Inbox / Approvals</p>
      <h1>Decisions that need you.</h1>
      <p className="hero-copy">
        Cost, product, design, security, and protected actions pause here until an authorized owner
        resolves them.
      </p>
      <LivePanel
        resource="approvals"
        title="Approval inbox"
        description="Resolve only what is authorized, with an explicit audit trail."
      />
    </main>
  );
}
