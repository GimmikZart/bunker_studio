import { agentCreateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebAgentRepository } from '../_data';

export async function GET(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const userId = await resolveActorId(request);
  if (!organizationId || !userId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const store = await getWebAgentRepository();
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({ agents: await store.listAgents(organizationId, userId) });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const userId = await resolveActorId(request);
  if (!organizationId || !userId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const store = await getWebAgentRepository();
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const input = agentCreateSchema.parse(await request.json());
    return NextResponse.json(
      { agent: await store.createAgent({ ...input, organizationId, actorUserId: userId }) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid agent payload.' }, { status: 400 });
  }
}
