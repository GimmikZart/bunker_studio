import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from './index';

describe('Git webhook boundary', () => {
  it('verifies signatures without exposing installation secrets', () => {
    const payload = '{}';
    const secret = 'test-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(payload, signature, 'wrong')).toBe(false);
  });
});
