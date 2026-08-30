import { notificationPreferencesSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository } from '../../_data';

export async function GET(request: Request) {
  return handle(request, undefined);
}

export async function PATCH(request: Request) {
  try {
    return await handle(request, notificationPreferencesSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: 'Invalid notification preferences.' }, { status: 400 });
  }
}

async function handle(
  request: Request,
  preferences:
    | Parameters<
        NonNullable<
          Awaited<ReturnType<typeof getWebOperationalRepository>>
        >['saveNotificationPreferences']
      >[2]
    | undefined,
) {
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
  try {
    const role = await operations.getRole(organizationId, actorId);
    if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    const result = preferences
      ? await operations.saveNotificationPreferences(organizationId, actorId, preferences, actorId)
      : await operations.getNotificationPreferences(organizationId, actorId, actorId);
    return NextResponse.json({ preferences: result });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}
