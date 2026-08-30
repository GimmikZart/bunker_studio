import { OrganizationCrudPanel } from '../_components/organization-crud-panel';

export default function TeamsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Teams</p>
      <h1>Shape the right team.</h1>
      <p className="hero-copy">
        Teams group persistent agents around projects, scopes, capabilities, and reporting lines.
      </p>
      <OrganizationCrudPanel kind="teams" />
    </main>
  );
}
