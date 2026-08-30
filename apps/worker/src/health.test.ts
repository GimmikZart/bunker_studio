import { describe, expect, it } from 'vitest';
import { getWorkerHealth } from './health';

describe('worker health', () => {
  it('reports a healthy worker', () => {
    expect(getWorkerHealth()).toMatchObject({ service: 'worker', status: 'ok' });
  });
});
