import { approvalCreateSchema, approvalResolutionSchema } from '@bunker-studio/contracts';
import { canWrite } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import {
  addNotification,
  createApproval,
  listApprovals,
  resolveApproval,
  tenantStore,
} from '../_store';

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  return NextResponse.json({ approvals: listApprovals(organizationId) });
}

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (!tenantStore.getRole(organizationId, actorId))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const input = approvalCreateSchema.parse(await request.json());
    const approval = createApproval({ ...input, organizationId, requestedByUserId: actorId });
    addNotification({
      organizationId,
      userId: actorId,
      category: 'APPROVAL',
      severity: input.risk,
      title: input.title,
      body: 'An approval is waiting for an authorized decision.',
      deepLink: `/approvals?approvalId=${approval.id}`,
    });
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
  const role = tenantStore.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!canWrite(role))
    return NextResponse.json({ error: 'Owner or admin approval is required.' }, { status: 403 });
  try {
    const input = approvalResolutionSchema.parse(await request.json());
    const approval = resolveApproval(
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
