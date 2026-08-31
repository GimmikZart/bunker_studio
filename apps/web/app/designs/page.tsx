import { DesignPanel } from '../_components/design-panel';

export default function DesignsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Designs</p>
      <h1>Approve the interface before implementation.</h1>
      <p className="hero-copy">
        A frontend task references one immutable approved design version, so delivery begins with a
        shared decision.
      </p>
      <DesignPanel />
    </main>
  );
}
