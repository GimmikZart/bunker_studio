import { pushSubscriptionSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository } from '../../_data';

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const input = pushSubscriptionSchema.parse(await request.json());
    return NextResponse.json(
      { subscription: await operations.savePushSubscription(actorId, input) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
  }
}
