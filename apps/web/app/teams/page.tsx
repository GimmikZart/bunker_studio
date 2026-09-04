import { TeamCrudPanel } from '../_components/team-crud-panel';
import { TeamBuilderPanel } from '../_components/team-builder-panel';

export default function TeamsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Teams</p>
      <h1>Shape the right team.</h1>
      <p className="hero-copy">
        Describe what you need delivered and the studio proposes who to hire for it. You review
        every proposed member and choose their AI before anyone is created.
      </p>
      <TeamBuilderPanel />
      <TeamCrudPanel />
    </main>
  );
}
