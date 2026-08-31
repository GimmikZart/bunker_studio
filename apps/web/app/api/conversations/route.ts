import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';

const MAX_RESULTS = 50;

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim().toLocaleLowerCase() ?? '';
  const agentId = url.searchParams.get('agentId')?.trim() ?? '';
  const requestedLimit = Number(url.searchParams.get('limit') ?? 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_RESULTS, Math.max(1, Math.floor(requestedLimit)))
    : 20;

  try {
    const conversations = (await operations.listConversations(organizationId, actorId))
      .filter((conversation) => !agentId || conversation.agentId === agentId)
      .filter((conversation) => {
        if (!query) return true;
        return [conversation.externalSessionId, ...conversation.messages].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      })
      .slice(-limit)
      .reverse();
    return NextResponse.json({ conversations, query, limit });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}
