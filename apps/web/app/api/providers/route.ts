import { providerConnectionCreateSchema } from '@bunker-studio/contracts';
import { encryptSecret } from '@bunker-studio/db';
import { discoverAnthropicModels } from '@bunker-studio/provider-anthropic';
import { discoverOpenAITextModels } from '@bunker-studio/provider-openai';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';
import { usesSupabasePersistence } from '../_persistence';
import { addProviderConnection } from '../_store';
import { createWorkerServiceSupabaseClient } from '../_supabase';

type CatalogModel = { id: string; displayName: string; capabilities: string[] };

async function discoverModels(input: {
  providerType: 'OPENAI' | 'ANTHROPIC' | 'OPENAI_COMPATIBLE';
  apiKey: string;
  apiBaseUrl?: string;
  manualModels: string[];
}): Promise<{ models: CatalogModel[]; source: 'PROVIDER_API' | 'MANUAL' }> {
  if (input.providerType === 'OPENAI') {
    const models = await discoverOpenAITextModels({
      apiKey: input.apiKey,
      apiBaseUrl: input.apiBaseUrl,
    });
    return {
      models: models.map((model) => ({ ...model, displayName: model.id })),
      source: 'PROVIDER_API',
    };
  }
  if (input.providerType === 'ANTHROPIC') {
    return {
      models: await discoverAnthropicModels({
        apiKey: input.apiKey,
        apiBaseUrl: input.apiBaseUrl,
      }),
      source: 'PROVIDER_API',
    };
  }
  if (!input.apiBaseUrl) throw new Error('OpenAI-compatible providers require an API base URL.');
  if (!input.manualModels.length)
    throw new Error('OpenAI-compatible providers require at least one model ID.');
  return {
    models: input.manualModels.map((id) => ({
      id,
      displayName: id,
      capabilities: ['text', 'streaming', 'tool-calling'],
    })),
    source: 'MANUAL',
  };
}

export async function POST(request: Request) {
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
  const role = await operations.getRole(organizationId, actorId);
  if (role !== 'OWNER' && role !== 'ADMIN')
    return NextResponse.json({ error: 'Owner or admin access is required.' }, { status: 403 });

  // The key is always encrypted before it is stored, in either mode, so the
  // master key is non-negotiable.
  const masterKey = process.env.STUDIO_MASTER_KEY;
  if (!masterKey)
    return NextResponse.json(
      {
        error:
          'STUDIO_MASTER_KEY is not set, so an API key cannot be encrypted before storage. Generate a 32-byte base64url value, add it to .env as STUDIO_MASTER_KEY, and restart the server.',
      },
      { status: 503 },
    );
  const usesSupabase = usesSupabasePersistence();
  const service = usesSupabase ? createWorkerServiceSupabaseClient() : null;
  if (usesSupabase && !service)
    return NextResponse.json(
      {
        error:
          'Supabase service credentials are required to store a provider connection. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then restart.',
      },
      { status: 503 },
    );

  try {
    const input = providerConnectionCreateSchema.parse(await request.json());
    const existing = await operations.listProviders(organizationId, actorId);
    if (existing.some((provider) => provider.providerType === input.providerType))
      return NextResponse.json(
        { error: 'This organization already has an account for that provider.' },
        { status: 409 },
      );

    const catalog = await discoverModels(input);
    if (!catalog.models.length)
      return NextResponse.json(
        { error: 'The provider returned no compatible text models for this API key.' },
        { status: 409 },
      );
    const apiBaseUrl =
      input.apiBaseUrl ??
      (input.providerType === 'OPENAI'
        ? 'https://api.openai.com/v1'
        : 'https://api.anthropic.com/v1');
    const encryptedSecret = encryptSecret(input.apiKey, masterKey);
    let connectionId: string;
    if (service) {
      const { data, error } = await service.rpc('create_provider_connection_with_catalog', {
        target_organization_id: organizationId,
        input_provider_type: input.providerType,
        input_display_name: input.displayName,
        input_encrypted_secret: encryptedSecret,
        input_api_base_url: apiBaseUrl,
        input_catalog_source: catalog.source,
        input_models: catalog.models,
      });
      if (error || typeof data !== 'string') throw new Error('Provider persistence failed.');
      connectionId = data;
    } else {
      // Local run: the same encrypted blob, held in process memory only.
      connectionId = addProviderConnection({
        organizationId,
        providerType: input.providerType,
        displayName: input.displayName,
        apiBaseUrl,
        encryptedSecret,
        models: catalog.models.map((model) => model.id),
        capabilities: ['chat', 'streaming'],
      }).id;
    }
    return NextResponse.json(
      {
        provider: {
          id: connectionId,
          providerType: input.providerType,
          displayName: input.displayName,
          status: 'READY',
          models: catalog.models.map((model) => model.id),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
            : 'Provider setup failed.',
      },
      { status: 400 },
    );
  }
}
