import { OrganizationCrudPanel } from '../_components/organization-crud-panel';

export default function ProjectsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Projects</p>
      <h1>Work with a clear home.</h1>
      <p className="hero-copy">
        Projects bind goals, teams, repositories, budgets, workflows, and the agents responsible for
        delivery.
      </p>
      <OrganizationCrudPanel kind="projects" />
    </main>
  );
}
