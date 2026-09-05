import { NextResponse } from 'next/server';
import { engagementContext } from '../../../_engagement';
import { readProgress } from '../../../_stages';

/** Where this project has got to in its way of working, and what holds it. */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const context = await engagementContext(request, projectId);
  if (!context.ok) return context.response;
  try {
    const { progress, brief } = await readProgress({
      projectId,
      organizationId: context.organizationId,
      actorId: context.actorId,
      operations: context.operations,
    });
    if (!progress)
      return NextResponse.json(
        { error: 'This project follows a way of working the studio no longer has.' },
        { status: 409 },
      );
    return NextResponse.json({
      playbook: { key: progress.playbook.key, name: progress.playbook.name },
      briefApproved: Boolean(brief),
      stages: progress.stages.map((entry) => ({
        key: entry.stage.key,
        name: entry.stage.name,
        roleKey: entry.stage.roleKey,
        gate: entry.stage.gate,
        produces: entry.stage.produces,
        status: entry.status,
        ...(entry.waitingFor ? { waitingFor: entry.waitingFor } : {}),
      })),
      current: progress.current
        ? { key: progress.current.stage.key, waitingFor: progress.current.waitingFor }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `The progress of this project could not be read. ${
          error instanceof Error ? error.message : 'Unknown failure.'
        }`,
      },
      { status: 500 },
    );
  }
}
