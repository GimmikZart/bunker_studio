import { budgetPolicySchema, budgetPolicyUpdateSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebOperationalRepository } from '../../../_data';

async function authorized(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return {
      actorId: null,
      organizationId: null,
      response: NextResponse.json(
        { error: 'Authentication and organization are required.' },
        { status: 401 },
      ),
    };
  const operations = await getWebOperationalRepository();
  if (!operations)
    return {
      actorId,
      organizationId,
      operations: null,
      response: NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 }),
    };
  const role = await operations.getRole(organizationId, actorId);
  if (!role)
    return {
      actorId,
      organizationId,
      operations,
      response: NextResponse.json({ error: 'Organization access denied.' }, { status: 403 }),
    };
  if (!['OWNER', 'ADMIN'].includes(role))
    return {
      actorId,
      organizationId,
      operations,
      response: NextResponse.json(
        { error: 'Owner or admin budget policy access is required.' },
        { status: 403 },
      ),
    };
  return { actorId, organizationId, operations, response: null };
}

export async function PATCH(request: Request, context: { params: Promise<{ policyId: string }> }) {
  const access = await authorized(request);
  if (access.response) return access.response;
  if (!access.operations || !access.organizationId || !access.actorId)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const { policyId } = await context.params;
  try {
    const current = (
      await access.operations.listBudgetPolicies(access.organizationId, access.actorId)
    ).find((item) => item.id === policyId);
    if (!current) return NextResponse.json({ error: 'Budget policy not found.' }, { status: 404 });
    const patch = budgetPolicyUpdateSchema.parse(await request.json());
    const merged = budgetPolicySchema.parse({ ...current, ...patch });
    const policy = await access.operations.updateBudgetPolicy(
      access.organizationId,
      policyId,
      merged,
      access.actorId,
    );
    return policy
      ? NextResponse.json({ policy })
      : NextResponse.json({ error: 'Budget policy not found.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Invalid budget policy.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ policyId: string }> }) {
  const access = await authorized(request);
  if (access.response) return access.response;
  if (!access.operations || !access.organizationId || !access.actorId)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const { policyId } = await context.params;
  const deleted = await access.operations.deleteBudgetPolicy(
    access.organizationId,
    policyId,
    access.actorId,
  );
  return deleted
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: 'Budget policy not found.' }, { status: 404 });
}
