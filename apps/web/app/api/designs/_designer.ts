import type { DesignDraft, DesignProposalRequest } from '@bunker-studio/contracts';

const MAX_PREVIEW_BYTES = 60_000;
/** Re-checked at render time so a colour can never carry arbitrary CSS. */
const SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;

export type StaticDesignProposal = {
  title: string;
  rationale: string;
  spec: Record<string, unknown>;
  preview: { title: string; html: string };
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

/**
 * The v1 fallback for the Designer contract. It never executes model supplied
 * markup: it renders a small static HTML document from escaped structured data.
 * A provider-backed Designer can replace this generator while retaining the
 * same proposal and preview boundary.
 */
export function createStaticDesignProposals(input: DesignProposalRequest): StaticDesignProposal[] {
  const palettes = [
    { accent: '#7c3aed', surface: '#f5f3ff', name: 'Focused workspace' },
    { accent: '#0f766e', surface: '#f0fdfa', name: 'Calm workspace' },
    { accent: '#b45309', surface: '#fffbeb', name: 'Warm workspace' },
  ];
  const safeBrief = escapeHtml(input.brief);
  const safeConstraints = input.constraints.map(escapeHtml);
  return Array.from({ length: input.variantCount }, (_, index) => {
    const palette = palettes[index]!;
    const title = `Variant ${index + 1}: ${palette.name}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:${palette.surface};color:#172033;font:16px system-ui,sans-serif}.shell{max-width:900px;margin:32px auto;padding:24px}.badge{color:${palette.accent};font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.card{margin-top:16px;padding:24px;border:1px solid #d7dce5;border-radius:16px;background:#fff;box-shadow:0 12px 32px #17203312}h1{margin:8px 0 12px;font-size:28px}ul{padding-left:20px}.action{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:8px;background:${palette.accent};color:#fff;font-weight:700}</style></head><body><main class="shell"><span class="badge">Bunker Studio design preview</span><section class="card"><h1>${safeBrief}</h1><p>This is a safe static mockup for review. The approved version is the only design frontend work may reference.</p>${safeConstraints.length ? `<h2>Constraints</h2><ul>${safeConstraints.map((constraint) => `<li>${constraint}</li>`).join('')}</ul>` : ''}<span class="action">Primary action</span></section></main></body></html>`;
    if (new TextEncoder().encode(html).byteLength > MAX_PREVIEW_BYTES)
      throw new Error('Generated design preview exceeds the safe size limit.');
    return {
      title,
      rationale: `${palette.name} emphasizes a clear primary action while preserving the supplied brief and constraints.`,
      spec: {
        brief: input.brief,
        constraints: input.constraints,
        mainStates: ['default', 'empty', 'loading', 'error'],
        previewKind: 'STATIC_HTML',
        variant: index + 1,
      },
      preview: { title, html },
    };
  });
}

/**
 * Renders a Designer agent's structured draft into the same safe preview
 * boundary as the deterministic generator.
 *
 * Every field is HTML-escaped and the colours are re-checked against a strict
 * hex pattern before they reach a stylesheet, so a Designer response can never
 * introduce markup, styles or script into the preview a reviewer opens.
 */
export function renderDesignProposals(
  draft: DesignDraft,
  input: DesignProposalRequest,
): StaticDesignProposal[] {
  return draft.variants.map((variant, index) => {
    const accent = SAFE_COLOR.test(variant.accentColor) ? variant.accentColor : '#7c3aed';
    const surface = SAFE_COLOR.test(variant.surfaceColor) ? variant.surfaceColor : '#f5f3ff';
    const title = escapeHtml(variant.title);
    const sections = variant.sections
      .map(
        (section) =>
          `<section class="card"><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`,
      )
      .join('');
    const states = variant.mainStates.length
      ? `<section class="card"><h2>States</h2><ul>${variant.mainStates
          .map((state) => `<li>${escapeHtml(state)}</li>`)
          .join('')}</ul></section>`
      : '';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:${surface};color:#172033;font:16px system-ui,sans-serif}.shell{max-width:900px;margin:32px auto;padding:24px}.badge{color:${accent};font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.card{margin-top:16px;padding:24px;border:1px solid #d7dce5;border-radius:16px;background:#fff;box-shadow:0 12px 32px #17203312}h1{margin:8px 0 12px;font-size:28px}h2{margin:0 0 8px;font-size:18px}ul{padding-left:20px}.action{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:8px;background:${accent};color:#fff;font-weight:700}</style></head><body><main class="shell"><span class="badge">Bunker Studio design preview</span><section class="card"><h1>${escapeHtml(variant.headline)}</h1><p>${escapeHtml(variant.summary)}</p><span class="action">${escapeHtml(variant.primaryAction)}</span></section>${sections}${states}</main></body></html>`;
    if (new TextEncoder().encode(html).byteLength > MAX_PREVIEW_BYTES)
      throw new Error('Generated design preview exceeds the safe size limit.');
    return {
      title: variant.title,
      rationale: variant.rationale,
      spec: {
        brief: input.brief,
        constraints: input.constraints,
        mainStates: variant.mainStates,
        sections: variant.sections,
        accentColor: accent,
        surfaceColor: surface,
        previewKind: 'STATIC_HTML',
        source: 'DESIGNER_AGENT',
        variant: index + 1,
      },
      preview: { title, html },
    };
  });
}
