import { designDraftSchema, type DesignDraft } from '@bunker-studio/contracts';

/**
 * Prompt and parsing for a provider-backed Designer.
 *
 * The described fields are rendered by the studio into a safe card. When a
 * mockup is asked for, the Designer also writes real markup — and that markup
 * is never rendered in this origin: it goes into a sandbox with no access to
 * the page around it and no way to reach the network.
 */

export const MAX_DESIGN_RESPONSE_CHARACTERS = 200_000;

const MAX_BRIEF_CHARACTERS = 10_000;
const MAX_CONSTRAINTS = 30;
const MAX_CONSTRAINT_CHARACTERS = 500;

export function buildDesignPrompt(input: {
  brief: string;
  constraints: string[];
  variantCount: number;
  /** Ask for a navigable mockup rather than a described direction. */
  prototype?: boolean;
}): string {
  const constraints = input.constraints
    .map((constraint) => constraint.trim())
    .filter((constraint) => constraint.length > 0)
    .slice(0, MAX_CONSTRAINTS)
    .map((constraint) => constraint.slice(0, MAX_CONSTRAINT_CHARACTERS));
  return [
    'You are the Product Designer of a software studio. Propose interface directions for this brief.',
    '',
    `Brief:\n${input.brief.trim().slice(0, MAX_BRIEF_CHARACTERS)}`,
    '',
    constraints.length
      ? `Constraints:\n${constraints.map((constraint) => `- ${constraint}`).join('\n')}`
      : 'Constraints:\n- none stated',
    '',
    `Propose exactly ${input.variantCount} distinct variant${input.variantCount === 1 ? '' : 's'}.`,
    'Each variant needs a different visual and structural direction, not a restyle of the same one.',
    'Colours must be six-digit hex values such as #7c3aed, with readable contrast against the surface.',
    'List the main states the screen must handle, for example default, empty, loading and error.',
    ...(input.prototype
      ? [
          '',
          'Also build each variant as a real mockup, in three parts:',
          '- body: the HTML inside <body>. No <html>, <head>, <script> or <style> tags.',
          '- css: the stylesheet, as plain CSS with no <style> tag.',
          '- js: any behaviour, as plain JavaScript with no <script> tag. Leave it empty if the mockup needs none.',
          'It runs sealed: no network, no fonts, no images from anywhere. Use data: URIs, CSS and',
          'system fonts only, and inline SVG for anything drawn. Anything fetched will simply not appear.',
          'Make it look like the real screen, not a wireframe of one.',
        ]
      : [
          'Describe the design in words and colours only. Do not write HTML, CSS or code:',
          'the studio renders the preview from your fields.',
        ]),
    '',
    'Answer with a single JSON object and no prose, matching exactly:',
    '{"variants":[{"title":string,"rationale":string,"headline":string,"summary":string,',
    '"accentColor":string,"surfaceColor":string,"primaryAction":string,',
    `"sections":[{"heading":string,"body":string}],"mainStates":string[]${
      input.prototype ? ',"prototype":{"body":string,"css":string,"js":string}' : ''
    }}]}`,
  ].join('\n');
}

/**
 * Extracts the outermost JSON object from a model response, tolerating code
 * fences and surrounding prose without ever evaluating the text.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

export type DesignDraftOutcome = { ok: true; draft: DesignDraft } | { ok: false; reason: string };

/**
 * Validates a Designer response and trims it to the requested variant count.
 * A response that does not fit the contract is rejected rather than repaired,
 * so the caller can fall back to the deterministic generator.
 */
export function parseDesignDraft(text: string, variantCount: number): DesignDraftOutcome {
  if (text.length > MAX_DESIGN_RESPONSE_CHARACTERS)
    return { ok: false, reason: 'The design response exceeded the accepted size.' };
  const json = extractJsonObject(text);
  if (!json) return { ok: false, reason: 'The design response did not contain a JSON object.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'The design response was not valid JSON.' };
  }
  const result = designDraftSchema.safeParse(parsed);
  if (!result.success)
    return { ok: false, reason: 'The design draft did not match the agreed shape.' };
  if (result.data.variants.length < variantCount)
    return { ok: false, reason: 'The Designer returned fewer variants than requested.' };
  return { ok: true, draft: { variants: result.data.variants.slice(0, variantCount) } };
}
