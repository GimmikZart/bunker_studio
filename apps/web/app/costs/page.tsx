import { CostCenterPanel } from '../_components/cost-center-panel';

export default function CostsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Costs</p>
      <h1>Keep the studio sustainable.</h1>
      <p className="hero-copy">
        Track today, week, month, forecast, budgets, provider quota, and the runs driving spend.
      </p>
      <CostCenterPanel />
    </main>
  );
}
