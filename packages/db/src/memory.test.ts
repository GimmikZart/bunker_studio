import { describe, expect, it } from 'vitest';
import { retrieveBoundedContext } from './index';

describe('bounded memory retrieval', () => {
  it('selects relevant durable memories without dumping the archive', () => {
    const result = retrieveBoundedContext({
      task: 'schema migration',
      memories: Array.from({ length: 100 }, (_, index) => ({
        id: String(index),
        content: index === 4 ? 'schema migration decision' : `unrelated conversation ${index}`,
        type: 'PROJECT_KNOWLEDGE' as const,
        importance: 50,
        deletedAt: null,
      })),
      recentMessages: Array.from({ length: 20 }, (_, index) => `message ${index}`),
      maxItems: 4,
      maxTokens: 30,
    });
    expect(result.length).toBeLessThan(10);
    expect(result.some((item) => item.content.includes('schema migration'))).toBe(true);
    expect(result.every((item) => item.source !== 'conversation:archive')).toBe(true);
  });
});
