import { taskCreateSchema, taskStateSchema, taskTransitionSchema } from '@bunker-studio/contracts';
import { canWrite } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository, getWebTenancyRepository } from '../_data';

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
  try {
    return NextResponse.json({ tasks: await operations.listTasks(organizationId, actorId) });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
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
  const tenancy = await getWebTenancyRepository();
  if (!operations || !tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const input = taskCreateSchema.parse(await request.json());
    const project = (await tenancy.listProjects(organizationId, actorId)).find(
      (item) => item.id === input.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const tasks = await operations.listTasks(organizationId, actorId);
    if (input.dependencies.some((dependency) => !tasks.some((task) => task.id === dependency)))
      return NextResponse.json({ error: 'Task dependency not found.' }, { status: 400 });
    return NextResponse.json(
      { task: await operations.createTask({ organizationId, ...input }, actorId) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid task payload.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!actorId || !organizationId || !taskId)
    return NextResponse.json(
      { error: 'Authentication, organization and task are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await operations.getRole(organizationId, actorId);
  if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  if (!canWrite(role))
    return NextResponse.json(
      { error: 'Owner or admin task transition is required.' },
      { status: 403 },
    );
  try {
    const input = taskTransitionSchema.parse(await request.json());
    const state = taskStateSchema.parse(input.state);
    return NextResponse.json({
      task: await operations.transitionTask(taskId, organizationId, state, actorId),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    return NextResponse.json({ error: 'Invalid task transition.' }, { status: 409 });
  }
}
