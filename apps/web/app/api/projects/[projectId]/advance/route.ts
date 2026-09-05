import { NextResponse } from 'next/server';
import { advanceProject } from '../../../_conductor';
import { resolveActorId } from '../../../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../../../_data';

/**
 * Moves a project forward as far as it can go on its own.
 *
 * The studio calls this itself whenever something changes that could unblock
 * work — a plan committed, an agent put on the project, a task finished — so
 * this endpoint exists for the times nothing else did: a person pressing
 * "advance", or a worker checking in.
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const agents = await getWebAgentRepository();
  const tenancy = await getWebTenancyRepository();
  if (!operations || !agents || !tenancy)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const project = (await tenancy.listProjects(organizationId, actorId)).find(
      (candidate) => candidate.id === projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json(
      await advanceProject({ project, organizationId, actorId, operations, agents }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json(
      {
        error: `The project could not be advanced. ${
          error instanceof Error ? error.message : 'Unknown failure.'
        }`,
      },
      { status: 500 },
    );
  }
}
