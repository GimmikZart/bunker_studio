import { approvalCreateSchema, approvalResolutionSchema } from '@bunker-studio/contracts';
import { canWrite } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';

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
  return NextResponse.json({ approvals: await operations.listApprovals(organizationId, actorId) });
}

export async function POST(request: Request) {
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
  try {
    const input = approvalCreateSchema.parse(await request.json());
    const approval = await operations.createApproval(
      { ...input, organizationId, requestedByUserId: actorId },
      actorId,
    );
    await operations.addNotification(
      {
        organizationId,
        userId: actorId,
        category: 'APPROVAL',
        severity: input.risk,
        title: input.title,
        body: 'An approval is waiting for an authorized decision.',
        deepLink: `/approvals?approvalId=${approval.id}`,
      },
      actorId,
    );
    return NextResponse.json({ approval }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid approval payload.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const approvalId = new URL(request.url).searchParams.get('approvalId');
  if (!actorId || !organizationId || !approvalId)
    return NextResponse.json(
      { error: 'Authentication, organization and approval are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!canWrite(role))
    return NextResponse.json({ error: 'Owner or admin approval is required.' }, { status: 403 });
  try {
    const input = approvalResolutionSchema.parse(await request.json());
    const approval = await operations.resolveApproval(
      organizationId,
      approvalId,
      input.status,
      actorId,
      input.resolutionNote,
    );
    if (!approval)
      return NextResponse.json({ error: 'Pending approval not found.' }, { status: 404 });
    return NextResponse.json({ approval });
  } catch {
    return NextResponse.json({ error: 'Invalid approval resolution.' }, { status: 400 });
  }
}
