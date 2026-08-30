import { verificationRunSchema } from '@bunker-studio/contracts';
import { canWrite } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { getWebOperationalRepository } from '../../../_data';

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { taskId } = await context.params;
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const task = (await operations.listTasks(organizationId, actorId)).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    return NextResponse.json({
      verificationRuns: await operations.listVerificationRuns(organizationId, actorId, taskId),
    });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const { taskId } = await context.params;
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
  if (!canWrite(role))
    return NextResponse.json(
      { error: 'Owner or admin verification is required.' },
      { status: 403 },
    );
  try {
    const task = (await operations.listTasks(organizationId, actorId)).find(
      (candidate) => candidate.id === taskId,
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    const input = verificationRunSchema.parse(await request.json());
    const verificationRun = await operations.addVerificationRun(
      { ...input, organizationId, taskId },
      actorId,
    );
    return NextResponse.json({ verificationRun }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid verification payload.' }, { status: 400 });
  }
}
