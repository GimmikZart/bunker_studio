import { LivePanel } from '../_components/live-panel';

export default function CostsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Costs</p>
      <h1>Keep the studio sustainable.</h1>
      <p className="hero-copy">
        Track today, week, month, forecast, budgets, provider quota, and the runs driving spend.
      </p>
      <LivePanel
        resource="costs"
        title="Cost center"
        description="Numbers come from the deterministic ledger; narrative summaries never decide budget gates."
      />
    </main>
  );
}
