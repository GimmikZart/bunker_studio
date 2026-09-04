import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads the monorepo root `.env` as a side effect.
 *
 * This module is imported first so it runs before any other module reads a
 * setting: ES module imports are evaluated in order, so the load cannot be
 * expressed as a plain call in the entry point body.
 *
 * The worker starts from its own package directory, so without this it sees none
 * of the configuration this repository documents at the root. Real environment
 * variables still win over the file.
 */
function loadRootEnv(): void {
  // `apps/worker/src` in development and `apps/worker/dist` once built: both
  // sit three levels below the repository root. Only that path is tried, so a
  // stray .env outside the repository can never be picked up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  try {
    process.loadEnvFile(path.resolve(here, '../../..', '.env'));
  } catch {
    // A missing root .env is normal when the platform injects its own settings.
  }
}

loadRootEnv();
