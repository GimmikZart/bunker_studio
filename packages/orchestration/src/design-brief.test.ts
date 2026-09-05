import { describe, expect, it } from 'vitest';
import {
  MAX_DESIGN_RESPONSE_CHARACTERS,
  buildDesignPrompt,
  parseDesignDraft,
} from './design-brief.js';

function variant(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Focused workspace',
    rationale: 'Puts the primary action first.',
    headline: 'Track every run',
    summary: 'A calm board that surfaces what needs a decision.',
    accentColor: '#7c3aed',
    surfaceColor: '#f5f3ff',
    primaryAction: 'Start a run',
    sections: [{ heading: 'Board', body: 'Tasks grouped by state.' }],
    mainStates: ['default', 'empty', 'loading', 'error'],
    ...overrides,
  };
}

describe('buildDesignPrompt', () => {
  it('states the brief, the constraints and the variant count', () => {
    const prompt = buildDesignPrompt({
      brief: 'A dashboard for long-running agent work.',
      constraints: ['Dark mode must work.'],
      variantCount: 2,
    });
    expect(prompt).toContain('A dashboard for long-running agent work.');
    expect(prompt).toContain('Dark mode must work.');
    expect(prompt).toContain('Propose exactly 2 distinct variants.');
  });

  it('forbids the Designer from writing markup', () => {
    const prompt = buildDesignPrompt({ brief: 'A page.', constraints: [], variantCount: 1 });
    expect(prompt).toContain('Do not write HTML, CSS or code');
  });
});

describe('parseDesignDraft', () => {
  it('accepts a well-formed draft wrapped in a fenced block', () => {
    const body = JSON.stringify({ variants: [variant()] });
    const result = parseDesignDraft(`Here you go:\n\`\`\`json\n${body}\n\`\`\``, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.variants[0]?.title).toBe('Focused workspace');
  });

  it('trims extra variants down to the requested count', () => {
    const body = JSON.stringify({ variants: [variant(), variant({ title: 'Second' })] });
    const result = parseDesignDraft(body, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.variants).toHaveLength(1);
  });

  it('rejects a draft with fewer variants than requested', () => {
    const result = parseDesignDraft(JSON.stringify({ variants: [variant()] }), 3);
    expect(result).toEqual({
      ok: false,
      reason: 'The Designer returned fewer variants than requested.',
    });
  });

  it('rejects a colour that is not a plain hex value', () => {
    const injected = parseDesignDraft(
      JSON.stringify({ variants: [variant({ accentColor: 'red;} body{display:none' })] }),
      1,
    );
    expect(injected.ok).toBe(false);
    expect(
      parseDesignDraft(JSON.stringify({ variants: [variant({ surfaceColor: 'red' })] }), 1).ok,
    ).toBe(false);
  });

  it('rejects a response that is not JSON or does not match the shape', () => {
    expect(parseDesignDraft('I suggest a calm layout.', 1).ok).toBe(false);
    expect(parseDesignDraft('{"variants":[]}', 1).ok).toBe(false);
  });

  it('rejects an oversized response before parsing it', () => {
    // Tied to the limit itself: a mockup makes a legitimate response much
    // larger, and the number has already moved once.
    const result = parseDesignDraft(
      `{"variants":"${'x'.repeat(MAX_DESIGN_RESPONSE_CHARACTERS + 1)}"}`,
      1,
    );
    expect(result).toEqual({
      ok: false,
      reason: 'The design response exceeded the accepted size.',
    });
  });
});
