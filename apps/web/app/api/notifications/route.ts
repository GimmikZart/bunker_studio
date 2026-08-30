import { notificationCreateSchema, notificationReadSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { addNotification, listNotifications, markNotificationRead, tenantStore } from '../_store';

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
  const notifications = listNotifications(actorId, organizationId);
  return NextResponse.json({
    notifications,
    unread: notifications.filter((item) => !item.readAt).length,
  });
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
    const input = notificationCreateSchema.parse(await request.json());
    if (
      input.userId !== actorId &&
      !['OWNER', 'ADMIN'].includes(tenantStore.getRole(organizationId, actorId) ?? '')
    )
      return NextResponse.json(
        { error: 'Notification recipient is not allowed.' },
        { status: 403 },
      );
    return NextResponse.json(
      { notification: addNotification({ ...input, organizationId }) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid notification payload.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actorId = await resolveActorId(request);
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const { notificationId } = notificationReadSchema.parse(await request.json());
    if (!markNotificationRead(actorId, notificationId))
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Invalid notification payload.' }, { status: 400 });
  }
}
