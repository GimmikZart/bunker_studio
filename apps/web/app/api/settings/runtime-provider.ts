import type { ProviderRecord } from '../_supabase-operations';

type RuntimeEnvironment = {
  AGENT_PROVIDER_ENDPOINT?: string;
  AGENT_PROVIDER_MODEL?: string;
  AGENT_PROVIDER_TYPE?: string;
};

export function configuredRuntimeProvider(
  env: RuntimeEnvironment = process.env as RuntimeEnvironment,
): ProviderRecord | null {
  const endpoint = env.AGENT_PROVIDER_ENDPOINT?.trim();
  const model = env.AGENT_PROVIDER_MODEL?.trim();
  if (!endpoint || !model) return null;

  const providerType = (env.AGENT_PROVIDER_TYPE ?? 'openai-compatible').toUpperCase();
  const displayName =
    providerType === 'OPENAI'
      ? 'OpenAI runtime'
      : providerType === 'ANTHROPIC'
        ? 'Anthropic runtime'
        : 'OpenAI-compatible runtime';

  return {
    id: `environment-${providerType.toLowerCase()}`,
    providerType,
    displayName,
    status: 'READY',
    capabilities: ['chat', 'streaming'],
    models: [model],
    lastVerifiedAt: undefined,
  };
}
