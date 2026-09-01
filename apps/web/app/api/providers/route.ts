import { providerConnectionCreateSchema } from '@bunker-studio/contracts';
import { encryptSecret } from '@bunker-studio/db';
import { discoverAnthropicModels } from '@bunker-studio/provider-anthropic';
import { discoverOpenAITextModels } from '@bunker-studio/provider-openai';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';
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

  const masterKey = process.env.STUDIO_MASTER_KEY;
  const service = createWorkerServiceSupabaseClient();
  if (!masterKey || !service)
    return NextResponse.json(
      { error: 'Secure provider persistence is not configured.' },
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
    const { data, error } = await service.rpc('create_provider_connection_with_catalog', {
      target_organization_id: organizationId,
      input_provider_type: input.providerType,
      input_display_name: input.displayName,
      input_encrypted_secret: encryptSecret(input.apiKey, masterKey),
      input_api_base_url: apiBaseUrl,
      input_catalog_source: catalog.source,
      input_models: catalog.models,
    });
    if (error || typeof data !== 'string') throw new Error('Provider persistence failed.');
    return NextResponse.json(
      {
        provider: {
          id: data,
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
