'use client';

import { useState } from 'react';

export type ConnectedProvider = {
  id: string;
  displayName: string;
  providerType: string;
  status: string;
  models: string[];
};

const PROVIDER_LABELS: Record<string, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  OPENAI_COMPATIBLE: 'OpenAI-compatible',
  FAKE: 'Built-in test provider',
};

/**
 * One connected account, at a glance.
 *
 * A provider can expose hundreds of models. Printing them all turned the panel
 * into a wall of identifiers that nobody reads and that buries the one thing
 * that matters here: whether the account is connected. The list stays available
 * on request, in a scrollable region.
 */
export function ProviderSummary({ provider }: { provider: ConnectedProvider }) {
  const [showModels, setShowModels] = useState(false);
  const ready = provider.status === 'READY';
  const count = provider.models.length;

  return (
    <div className="provider-card">
      <div className="provider-card-head">
        <span className={`provider-dot ${ready ? 'ready' : 'pending'}`} aria-hidden="true" />
        <span className="provider-card-name">
          <strong>{provider.displayName}</strong>
          <small>
            {PROVIDER_LABELS[provider.providerType] ?? provider.providerType} ·{' '}
            {ready ? 'Connected' : provider.status.toLowerCase().replace(/_/g, ' ')}
          </small>
        </span>
      </div>
      {count > 0 ? (
        <button
          type="button"
          className="provider-models-toggle"
          aria-expanded={showModels}
          onClick={() => setShowModels((current) => !current)}
        >
          {showModels ? 'Hide' : 'Show'} {count} available model{count === 1 ? '' : 's'}
        </button>
      ) : (
        <small className="provider-empty">No models were returned for this account.</small>
      )}
      {showModels && count > 0 && (
        <ul className="provider-models">
          {provider.models.map((model) => (
            <li key={model}>{model}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
