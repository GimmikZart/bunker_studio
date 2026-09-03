/**
 * Read/write scopes are repository-relative path prefixes.  Two scopes overlap
 * when one is the other or contains it, so `apps/web` and `apps/web/app` are
 * never safe to write concurrently.
 */
export function scopesOverlap(left: string[], right: string[]): boolean {
  return left.some((a) =>
    right.some((b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)),
  );
}
