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
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/ during development, dist/ once built.
  for (const candidate of [
    path.resolve(here, '../../..', '.env'),
    path.resolve(here, '../../../..', '.env'),
  ]) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // Try the next location; a missing root .env is a normal hosted setup.
    }
  }
}

loadRootEnv();
