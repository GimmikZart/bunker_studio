import { memoryCreateSchema } from '@bunker-studio/contracts';
import { retrieveBoundedContext } from '@bunker-studio/db';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';

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
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const query = new URL(request.url).searchParams.get('query')?.trim() ?? '';
  const memories = await operations.listMemories(organizationId, actorId);
  return NextResponse.json({
    memories: query
      ? retrieveBoundedContext({ task: query, memories, recentMessages: [] })
      : memories,
  });
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
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = memoryCreateSchema.parse(await request.json());
    return NextResponse.json(
      {
        memory: await operations.addMemory(
          organizationId,
          {
            ...input,
            type: input.type,
            importance: input.importance,
            content: input.content,
          },
          actorId,
        ),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid memory payload.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
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
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const memoryId = new URL(request.url).searchParams.get('memoryId');
  if (!memoryId || !(await operations.deleteMemory(organizationId, memoryId, actorId)))
    return NextResponse.json({ error: 'Memory not found.' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
