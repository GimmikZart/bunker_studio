import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';
import { configuredRuntimeProvider } from './runtime-provider';

export async function GET(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const role = await operations.getRole(organizationId, actorId);
    if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    const persistedProviders = await operations.listProviders(organizationId, actorId);
    const hasReadyProvider = persistedProviders.some(
      (provider) => provider.status === 'READY' && provider.models.length > 0,
    );
    const environmentProvider = configuredRuntimeProvider();
    const providers =
      process.env.NODE_ENV === 'production' && !hasReadyProvider && environmentProvider
        ? [...persistedProviders, environmentProvider]
        : persistedProviders;
    return NextResponse.json({
      providers,
      workers: await operations.listWorkers(organizationId, actorId),
      runtime: {
        mode: process.env.NODE_ENV === 'production' ? 'configured-runtime' : 'local-fake',
        providerType:
          process.env.NODE_ENV === 'production'
            ? (process.env.AGENT_PROVIDER_TYPE ?? 'openai-compatible')
            : 'fake',
        endpointConfigured: Boolean(process.env.AGENT_PROVIDER_ENDPOINT),
        apiKeyConfigured: Boolean(process.env.AGENT_PROVIDER_API_KEY),
        model: process.env.AGENT_PROVIDER_MODEL ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}
