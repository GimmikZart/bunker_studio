import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, slugify } from './index';

describe('core package', () => {
  it('exposes its package identity', () => {
    expect(PACKAGE_NAME).toBe('@bunker-studio/core');
  });

  it('creates stable URL slugs without external state', () => {
    expect(slugify('  Bunker Studio / Core  ')).toBe('bunker-studio-core');
  });
});
