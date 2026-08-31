import Link from 'next/link';
import { NavigationLinks } from './navigation-links';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="brand-mark" href="/">
            <span className="brand-dot" aria-hidden="true" />
            <span>Bunker Studio</span>
          </Link>
          <NavigationLinks />
          <Link className="avatar-button" href="/settings" aria-label="Open settings">
            GM
          </Link>
        </div>
      </header>
      {children}
      <NavigationLinks mobile />
    </>
  );
}
