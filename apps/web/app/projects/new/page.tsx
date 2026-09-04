import { ProjectCreateView } from '../../_components/project-create-view';

export default function NewProjectPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Projects / New</p>
      <h1>Start a project.</h1>
      <p className="hero-copy">
        Name the work and pick the repository it happens in. The repository list comes from the
        GitHub account connected to this organization in Settings.
      </p>
      <ProjectCreateView />
    </main>
  );
}
