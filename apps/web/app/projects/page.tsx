import { ProjectDirectory } from '../_components/project-directory';

export default function ProjectsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Projects</p>
      <h1>Every project, at a glance.</h1>
      <p className="hero-copy">
        Each project binds a repository, the agents working on it, its budget and its workflow. Open
        one to see what it holds.
      </p>
      <ProjectDirectory />
    </main>
  );
}
