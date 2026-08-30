import { memberInviteSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { tenantStore } from '../../../_store';

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorId = await resolveActorId(request);
  const { organizationId } = await context.params;
  if (!actorId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  try {
    return NextResponse.json({ members: tenantStore.listMembers(organizationId, actorId) });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorId = await resolveActorId(request);
  const { organizationId } = await context.params;
  if (!actorId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  try {
    const input = memberInviteSchema.parse(await request.json());
    const member = tenantStore.addMember({ ...input, organizationId, actorUserId: actorId });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid member payload.' }, { status: 400 });
  }
}
