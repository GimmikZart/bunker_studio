import { CostCenterPanel } from '../_components/cost-center-panel';

export default function CostsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Costs</p>
      <h1>Keep the studio sustainable.</h1>
      <p className="hero-copy">
        What your studio is spending, and on what. Set a ceiling here and work that would cross it
        is stopped before any paid call is made.
      </p>
      <CostCenterPanel />
    </main>
  );
}
