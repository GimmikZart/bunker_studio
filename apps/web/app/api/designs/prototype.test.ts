import { describe, expect, it } from 'vitest';
import { renderDesignProposals, renderPrototypeDocument } from './_designer';
import { buildDesignPrompt, parseDesignDraft } from '@bunker-studio/orchestration';

const variant = {
  title: 'Bold checkout',
  rationale: 'One column, one decision per screen.',
  headline: 'Pay as a guest',
  summary: 'No account, no friction.',
  accentColor: '#7c3aed',
  surfaceColor: '#f5f3ff',
  primaryAction: 'Pay now',
  sections: [],
  mainStates: [],
};

const prototype = {
  body: '<main id="app"><h1>Pay as a guest</h1><button id="go">Pay now</button></main>',
  css: 'body{font-family:system-ui;background:#f5f3ff}',
  js: "document.getElementById('go').addEventListener('click', () => alert('paid'));",
};

describe('the mockup envelope', () => {
  it('is written by the studio, with the policy first', () => {
    const html = renderPrototypeDocument(prototype, 'Bold checkout');
    const head = html.slice(0, html.indexOf('</head>'));
    // The policy has to be the first one the browser reads, which is why the
    // Designer never gets to write the document itself.
    expect(head).toContain('Content-Security-Policy');
    expect(head.indexOf('Content-Security-Policy')).toBeLessThan(head.indexOf('<style>'));
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('seals the mockup off from the network', () => {
    const html = renderPrototypeDocument(prototype, 'Bold checkout');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('img-src data:');
    expect(html).toContain("form-action 'none'");
    expect(html).toContain("base-uri 'none'");
  });

  it('keeps the Designer markup, styles and behaviour intact', () => {
    const html = renderPrototypeDocument(prototype, 'Bold checkout');
    expect(html).toContain('<button id="go">Pay now</button>');
    expect(html).toContain('background:#f5f3ff');
    expect(html).toContain("alert('paid')");
  });

  it('escapes the title, which is ours to write', () => {
    const html = renderPrototypeDocument(prototype, '</title><script>stolen()</script>');
    expect(html).not.toContain('<script>stolen()');
    expect(html).toContain('&lt;script&gt;');
  });

  it('leaves out the script tag entirely when there is no behaviour', () => {
    const html = renderPrototypeDocument({ ...prototype, js: '' }, 'Quiet');
    expect(html).not.toContain('<script>');
  });

  it('refuses a mockup larger than the studio will store', () => {
    expect(() =>
      renderPrototypeDocument({ ...prototype, css: 'a{}'.repeat(25_000) }, 'Huge'),
    ).toThrow(/larger than the studio/);
  });
});

describe('a proposal carrying a mockup', () => {
  it('previews the mockup and marks it as one', () => {
    const [proposal] = renderDesignProposals(
      { variants: [{ ...variant, prototype }] },
      {
        designerAgentId: 'a',
        brief: 'checkout',
        constraints: [],
        variantCount: 1,
        prototype: true,
      },
    );
    expect(proposal!.preview.html).toContain('<button id="go">Pay now</button>');
    expect(proposal!.spec.previewKind).toBe('PROTOTYPE');
  });

  it('still renders a described direction when no mockup was asked for', () => {
    const [proposal] = renderDesignProposals(
      { variants: [variant] },
      {
        designerAgentId: 'a',
        brief: 'checkout',
        constraints: [],
        variantCount: 1,
        prototype: false,
      },
    );
    expect(proposal!.spec.previewKind).toBe('STATIC_HTML');
    expect(proposal!.preview.html).toContain('Bunker Studio design preview');
  });
});

describe('asking the Designer for a mockup', () => {
  it('asks for the three parts and forbids the tags the studio writes', () => {
    const prompt = buildDesignPrompt({
      brief: 'A checkout',
      constraints: [],
      variantCount: 1,
      prototype: true,
    });
    expect(prompt).toContain('"prototype":{"body":string,"css":string,"js":string}');
    expect(prompt).toContain('No <html>, <head>, <script> or <style> tags');
    expect(prompt).toContain('no network');
  });

  it('keeps telling the Designer not to write markup when no mockup is wanted', () => {
    const prompt = buildDesignPrompt({ brief: 'A checkout', constraints: [], variantCount: 1 });
    expect(prompt).toContain('Do not write HTML, CSS or code');
    expect(prompt).not.toContain('"prototype"');
  });

  it('reads a draft that carries a mockup', () => {
    const outcome = parseDesignDraft(JSON.stringify({ variants: [{ ...variant, prototype }] }), 1);
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.draft.variants[0]!.prototype?.body).toContain('Pay as a guest');
  });

  it('rejects a mockup with no body at all', () => {
    const outcome = parseDesignDraft(
      JSON.stringify({ variants: [{ ...variant, prototype: { ...prototype, body: '' } }] }),
      1,
    );
    expect(outcome.ok).toBe(false);
  });
});
