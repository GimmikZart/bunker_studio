import { budgetPolicySchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository } from '../../_data';

function context(request: Request) {
  return {
    organizationId: request.headers.get('x-bunker-organization-id')?.trim(),
  };
}

export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const { organizationId } = context(request);
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    return NextResponse.json({
      policies: await operations.listBudgetPolicies(organizationId, actorId),
    });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const { organizationId } = context(request);
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin budget policy access is required.' },
      { status: 403 },
    );
  try {
    const input = budgetPolicySchema.parse(await request.json());
    const policy = await operations.createBudgetPolicy(organizationId, input, actorId);
    return NextResponse.json({ policy }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid budget policy.' }, { status: 400 });
  }
}
