import { SettingsPanel } from '../_components/settings-panel';

export default function SettingsPage() {
  return (
    <main className="shell content-shell">
      <p className="eyebrow">Organization / Settings</p>
      <h1>Make the rules explicit.</h1>
      <p className="hero-copy">
        Manage providers, local workers, notifications, autonomy, budget policy, and protected
        Studio mode.
      </p>
      <SettingsPanel />
    </main>
  );
}
