'use client';

import { useState } from 'react';
import type { Choice } from './agent-capabilities';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type Agent = {
  id: string;
  name: string;
  roleKey: string;
  title: string;
  avatarAssetId: string | null;
  skills: string[];
  tools: string[];
  permissions: string[];
  providerBindingId: string;
  providerConnectionId: string;
  providerType: string;
  providerModelId: string;
  runtimeType: string;
  reasoningEffort: ReasoningEffort;
};

export type Provider = {
  id: string;
  displayName: string;
  providerType: string;
  status: string;
  models: string[];
};

export type Organization = { id: string; name: string };

/**
 * The avatar choices. Each is a colour rather than an uploaded image: the studio
 * stores an asset id, and until a real asset exists a stable colour and the
 * agent's initials tell one card from another at a glance.
 */
export const AVATARS: { id: string; label: string; color: string }[] = [
  { id: '', label: 'Default', color: '#6d7884' },
  { id: '00000000-0000-0000-0000-000000000001', label: 'Amber', color: '#d9822b' },
  { id: '00000000-0000-0000-0000-000000000002', label: 'Cobalt', color: '#3c6df0' },
  { id: '00000000-0000-0000-0000-000000000003', label: 'Mint', color: '#1f9d6b' },
];

export function avatarColor(avatarAssetId: string | null): string {
  return AVATARS.find((avatar) => avatar.id === (avatarAssetId ?? ''))?.color ?? '#6d7884';
}

/** Up to two initials, taken from the words of the name. */
export function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0]![0]! + (parts[1]?.[0] ?? '')).toLocaleUpperCase();
}

export function AgentAvatar({
  agent,
  size = 'large',
}: {
  agent: Pick<Agent, 'name' | 'avatarAssetId'>;
  size?: 'large' | 'small';
}) {
  return (
    <span
      aria-hidden="true"
      className={size === 'small' ? 'agent-avatar agent-avatar-small' : 'agent-avatar'}
      style={{ background: avatarColor(agent.avatarAssetId) }}
    >
      {agentInitials(agent.name)}
    </span>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  OPENAI_COMPATIBLE: 'OpenAI-compatible',
  FAKE: 'Local fake provider',
};

export function providerLabel(providerType: string): string {
  return PROVIDER_LABELS[providerType] ?? providerType;
}

export const REASONING_LABELS: Record<ReasoningEffort, string> = {
  none: 'no reasoning',
  low: 'low reasoning',
  medium: 'medium reasoning',
  high: 'high reasoning',
  xhigh: 'extra-high reasoning',
  max: 'maximum reasoning',
};

/** The runtimes a given provider can actually drive. */
export function runtimeChoices(provider: Provider | undefined): { value: string; label: string }[] {
  if (!provider) return [];
  if (provider.providerType === 'OPENAI')
    return [
      { value: 'OPENAI', label: 'OpenAI API (general purpose)' },
      { value: 'CODEX_SDK', label: 'Codex SDK (repository work)' },
    ];
  if (provider.providerType === 'ANTHROPIC')
    return [{ value: 'ANTHROPIC', label: 'Anthropic API' }];
  return [{ value: 'OPENAI_COMPATIBLE', label: 'OpenAI-compatible API' }];
}

export function defaultRuntimeFor(provider: Provider | undefined): string {
  if (!provider) return '';
  if (provider.providerType === 'OPENAI') return 'OPENAI';
  if (provider.providerType === 'ANTHROPIC') return 'ANTHROPIC';
  return 'OPENAI_COMPATIBLE';
}

/**
 * A capability list as choices rather than a text box. The identifiers mean
 * something to the studio, so guessing them should not be part of creating an
 * agent — while anything you add yourself is still accepted.
 */
export function CapabilityPicker({
  legend,
  name,
  choices,
  selected,
  onChange,
  addLabel,
}: {
  legend: React.ReactNode;
  name: string;
  choices: Choice[];
  selected: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  const [custom, setCustom] = useState('');
  const extras = selected.filter((value) => !choices.some((choice) => choice.id === value));

  function toggle(value: string, checked: boolean) {
    onChange(
      checked ? [...new Set([...selected, value])] : selected.filter((item) => item !== value),
    );
  }

  return (
    <fieldset className="capability-picker">
      <legend>{legend}</legend>
      <div className="capability-options">
        {choices.map((choice) => (
          <label className="capability-option" key={choice.id}>
            <input
              type="checkbox"
              name={name}
              value={choice.id}
              checked={selected.includes(choice.id)}
              onChange={(event) => toggle(choice.id, event.target.checked)}
            />
            <span>
              <strong>{choice.label}</strong>
              <small>{choice.description}</small>
            </span>
          </label>
        ))}
        {extras.map((value) => (
          <label className="capability-option" key={value}>
            <input
              type="checkbox"
              name={name}
              value={value}
              checked
              onChange={(event) => toggle(value, event.target.checked)}
            />
            <span>
              <strong>{value}</strong>
              <small>Added by you.</small>
            </span>
          </label>
        ))}
      </div>
      <div className="capability-add">
        <input
          id={`${name}-add`}
          aria-label={addLabel}
          placeholder={addLabel}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (!custom.trim()) return;
            onChange([...new Set([...selected, custom.trim()])]);
            setCustom('');
          }}
        />
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            if (!custom.trim()) return;
            onChange([...new Set([...selected, custom.trim()])]);
            setCustom('');
          }}
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}
