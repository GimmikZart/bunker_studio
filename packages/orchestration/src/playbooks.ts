/**
 * How the studio works, written down once.
 *
 * A playbook is data, not a prompt: the stages, who runs each one, what it
 * produces and what closes it are typed, versioned with the repository and
 * tested. The model is asked only which playbook fits what the user described;
 * everything the engine then does follows from these definitions.
 *
 * The two playbooks below are less different than they look, which is the point
 * — they are composed from the same stages. Adding a third should mostly be a
 * matter of ordering existing ones.
 */

export type StageKind =
  'INTERVIEW' | 'HARVEST' | 'DOCUMENT' | 'DESIGN' | 'PLAN' | 'EXECUTE' | 'DELIVER';

/** What closes a stage. Never the model's own opinion that it is finished. */
export type StageGate = 'HUMAN_APPROVAL' | 'REVIEW_PASS' | 'AUTOMATIC';

/**
 * Something a stage needs that the studio may not have built yet. Naming it
 * here means a playbook can say honestly which of its stages cannot run,
 * instead of failing halfway through with a puzzled agent.
 */
export type StageCapability = 'WEB_HARVEST' | 'DESIGN_PROTOTYPE';

export type Stage = {
  key: string;
  name: string;
  kind: StageKind;
  /** The role that runs it. */
  roleKey: string;
  gate: StageGate;
  /** A stage that is skipped unless the work calls for it. */
  optional: boolean;
  /** What it leaves behind. */
  produces: string;
  requires?: StageCapability[];
};

export type Playbook = {
  key: string;
  name: string;
  version: number;
  summary: string;
  /** In the user's terms, so the Lead can recognise which one is being asked for. */
  whenToUse: string;
  stages: Stage[];
};

const DISCOVERY: Stage = {
  key: 'discovery',
  name: 'Understand what is wanted',
  kind: 'INTERVIEW',
  roleKey: 'lead',
  gate: 'HUMAN_APPROVAL',
  optional: false,
  produces: 'An agreed brief: scope, assumptions and what is deliberately out.',
};

const HARVEST: Stage = {
  key: 'harvest',
  name: 'Take the existing site apart',
  kind: 'HARVEST',
  roleKey: 'lead',
  gate: 'AUTOMATIC',
  optional: false,
  produces: 'The content, structure and assets of the source site.',
  requires: ['WEB_HARVEST'],
};

const DIRECTION: Stage = {
  key: 'direction',
  name: 'Agree a creative direction',
  kind: 'DESIGN',
  roleKey: 'designer',
  gate: 'HUMAN_APPROVAL',
  optional: false,
  produces: 'A direction drawn from the references, before anything is drawn.',
};

const PROTOTYPE: Stage = {
  key: 'prototype',
  name: 'Show it before building it',
  kind: 'DESIGN',
  roleKey: 'designer',
  gate: 'HUMAN_APPROVAL',
  optional: false,
  produces: 'A navigable mockup to approve or reject.',
  requires: ['DESIGN_PROTOTYPE'],
};

const DESIGN: Stage = {
  ...PROTOTYPE,
  key: 'design',
  name: 'Design what needs designing',
  optional: true,
  produces: 'An approved design version that frontend work may cite.',
};

const SPEC: Stage = {
  key: 'spec',
  name: 'Write it down',
  kind: 'DOCUMENT',
  roleKey: 'lead',
  gate: 'HUMAN_APPROVAL',
  optional: false,
  produces: 'A technical document in the repository, on its own branch.',
};

const DECOMPOSITION: Stage = {
  key: 'decomposition',
  name: 'Break it into work',
  kind: 'PLAN',
  roleKey: 'lead',
  gate: 'HUMAN_APPROVAL',
  optional: false,
  produces: 'A validated plan that becomes assigned tasks.',
};

const EXECUTION: Stage = {
  key: 'execution',
  name: 'Build it',
  kind: 'EXECUTE',
  roleKey: 'lead',
  gate: 'REVIEW_PASS',
  optional: false,
  produces: 'Branches, pull requests, verification and review for every task.',
};

const DELIVERY: Stage = {
  key: 'delivery',
  name: 'Say what was delivered',
  kind: 'DELIVER',
  roleKey: 'lead',
  gate: 'AUTOMATIC',
  optional: false,
  produces: 'A summary of what shipped and what is left.',
};

export const PLAYBOOKS: Playbook[] = [
  {
    key: 'feature-on-existing-repo',
    name: 'Feature on an existing repository',
    version: 1,
    summary: 'From a conversation to merged work on a repository you already have.',
    whenToUse:
      'The user wants something added, changed or fixed in a codebase that already exists.',
    stages: [DISCOVERY, SPEC, DESIGN, DECOMPOSITION, EXECUTION, DELIVERY],
  },
  {
    key: 'site-redesign',
    name: 'Redesign of an existing site',
    version: 1,
    summary: 'Keep the content of a site, replace how it looks, then build it.',
    whenToUse:
      'The user points at a site — usually one they do not own yet — and wants it rebuilt or made to look better, keeping its content.',
    stages: [HARVEST, DISCOVERY, DIRECTION, PROTOTYPE, SPEC, DECOMPOSITION, EXECUTION, DELIVERY],
  },
  {
    key: 'new-product',
    name: 'A new product from nothing',
    version: 1,
    summary: 'From an idea to a first working version.',
    whenToUse: 'The user describes something that does not exist yet and wants it built.',
    stages: [DISCOVERY, DESIGN, SPEC, DECOMPOSITION, EXECUTION, DELIVERY],
  },
];

export function findPlaybook(key: string): Playbook | undefined {
  return PLAYBOOKS.find((playbook) => playbook.key === key);
}

export const DEFAULT_PLAYBOOK_KEY = 'feature-on-existing-repo';

/**
 * Which stages of a playbook the studio can actually run today.
 *
 * A playbook that names a capability nobody has built is not a failure to hide:
 * the honest answer is to say which stage will stop, so the choice to start
 * anyway is the user's.
 */
export function unavailableStages(
  playbook: Playbook,
  available: StageCapability[],
): { stage: Stage; missing: StageCapability[] }[] {
  return playbook.stages
    .map((stage) => ({
      stage,
      missing: (stage.requires ?? []).filter((capability) => !available.includes(capability)),
    }))
    .filter((entry) => entry.missing.length > 0);
}

/** The catalogue as the Lead is shown it, so it can only choose a real one. */
export function playbookCatalogue(): string {
  return PLAYBOOKS.map(
    (playbook) => `- ${playbook.key}: ${playbook.summary} Use when: ${playbook.whenToUse}`,
  ).join('\n');
}
