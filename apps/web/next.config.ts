import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Load the monorepo root `.env`.
 *
 * Next.js only reads `.env` files from the app directory, but this repository
 * documents a single `.env` at the root next to `.env.example`. Without this the
 * app silently ignored SUPABASE_URL, STUDIO_MASTER_KEY and the persistence mode,
 * and fell back to an in-memory store while appearing to be configured.
 *
 * Real environment variables still win: this only fills in what the shell or the
 * hosting platform has not already set.
 */
function loadRootEnv() {
  const rootEnv = path.resolve(process.cwd(), '../..', '.env');
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    // No root .env is a normal setup on a hosting platform that injects its own.
  }
}
loadRootEnv();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@bunker-studio/core', '@bunker-studio/contracts', '@bunker-studio/db'],
};

export default nextConfig;
