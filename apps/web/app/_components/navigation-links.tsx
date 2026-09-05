'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['Office', '/'],
  ['Projects', '/projects'],
  ['Agents', '/agents'],
  ['Tasks', '/tasks'],
  ['Approvals', '/approvals'],
  ['Notifications', '/notifications'],
  ['Meetings', '/meetings'],
  ['Costs', '/costs'],
  ['Activity', '/activity'],
  ['Settings', '/settings'],
] as const;
const active = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

export function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const mapped = items.map(([label, href]) => ({ label, href, current: active(pathname, href) }));
  if (mobile)
    return (
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {mapped.slice(0, 4).map((item) => (
          <Link
            aria-current={item.current ? 'page' : undefined}
            className={item.current ? 'active' : ''}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
        <details>
          <summary aria-label="Open all navigation routes">More</summary>
          <div className="mobile-navigation-menu">
            {mapped.slice(4).map((item) => (
              <Link
                aria-current={item.current ? 'page' : undefined}
                className={item.current ? 'active' : ''}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </details>
      </nav>
    );
  return (
    <nav className="nav-links" aria-label="Primary navigation">
      {mapped.map((item) => (
        <Link
          aria-current={item.current ? 'page' : undefined}
          className={item.current ? 'active' : ''}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
