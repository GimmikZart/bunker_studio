import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secrets';

describe('provider secret encryption', () => {
  it('round-trips AES-256-GCM without persisting plaintext', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encryptSecret('provider-secret', key);
    expect(JSON.stringify(encrypted)).not.toContain('provider-secret');
    expect(decryptSecret(encrypted, key)).toBe('provider-secret');
  });

  it('rejects invalid master keys', () => {
    expect(() => encryptSecret('secret', 'bad')).toThrow();
  });
});
