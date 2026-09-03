import Link from 'next/link';
import { AccountLink } from './account-link';
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
          <AccountLink />
        </div>
      </header>
      {children}
      <NavigationLinks mobile />
    </>
  );
}
