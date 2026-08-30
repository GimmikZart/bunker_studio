import { agentUpdateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebAgentRepository } from '../../_data';

export async function PATCH(request: Request, context: { params: Promise<{ agentId: string }> }) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorUserId = await resolveActorId(request);
  const { agentId } = await context.params;
  if (!organizationId || !actorUserId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const store = await getWebAgentRepository();
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({
      agent: await store.updateAgent(
        agentId,
        organizationId,
        actorUserId,
        agentUpdateSchema.parse(await request.json()),
      ),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid agent payload.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ agentId: string }> }) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorUserId = await resolveActorId(request);
  const { agentId } = await context.params;
  if (!organizationId || !actorUserId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const store = await getWebAgentRepository();
  if (!store)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    await store.archiveAgent(agentId, organizationId, actorUserId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  }
}
