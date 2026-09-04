import { DesignPanel } from '../_components/design-panel';

export default function DesignsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Designs</p>
      <h1>Approve the interface before implementation.</h1>
      <p className="hero-copy">
        Ask the Designer for screen proposals, then approve the one you want. Work on a screen can
        only start from a design you have approved, and an approved design can no longer change.
      </p>
      <DesignPanel />
    </main>
  );
}
