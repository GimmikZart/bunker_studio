import { OrganizationCrudPanel } from '../_components/organization-crud-panel';
import { TeamBuilderPanel } from '../_components/team-builder-panel';

export default function TeamsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Teams</p>
      <h1>Shape the right team.</h1>
      <p className="hero-copy">
        Teams group persistent agents around projects, scopes, capabilities, and reporting lines.
      </p>
      <TeamBuilderPanel />
      <OrganizationCrudPanel kind="teams" />
    </main>
  );
}
