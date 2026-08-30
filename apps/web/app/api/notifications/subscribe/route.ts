import { pushSubscriptionSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { savePushSubscription } from '../../_store';

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const input = pushSubscriptionSchema.parse(await request.json());
    return NextResponse.json(
      { subscription: savePushSubscription(actorId, input) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
  }
}
