import { engagementApprovalSchema } from '@bunker-studio/contracts';
import { findPlaybook } from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { BRIEF_MEMORY_PREFIX, engagementContext } from '../../../../_engagement';

/**
 * The moment the brief becomes the thing the work answers to.
 *
 * Only a person can do this. The Lead may say it believes the brief is ready;
 * that opinion has never advanced anything, and the studio would rather ask one
 * question too many than build the wrong thing confidently.
 *
 * What is stored is exactly what was approved, kept as pinned project memory so
 * every later run carries it without anyone pasting it again.
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const context = await engagementContext(request, projectId);
  if (!context.ok) return context.response;
  try {
    const { brief } = engagementApprovalSchema.parse(await request.json());
    const playbook = findPlaybook(brief.playbookKey);
    if (!playbook)
      return NextResponse.json(
        { error: `The studio has no way of working called "${brief.playbookKey}".` },
        { status: 400 },
      );
    if (brief.questions.length)
      return NextResponse.json(
        {
          error:
            'The Lead still has open questions. Answer them first, or remove them from the brief you are approving.',
        },
        { status: 409 },
      );

    const memory = await context.operations.addMemory(
      context.organizationId,
      {
        content: `${BRIEF_MEMORY_PREFIX}${JSON.stringify(brief)}`,
        type: 'PINNED',
        importance: 95,
        projectId,
      },
      context.actorId,
    );
    await context.operations
      .recordActivity({
        organizationId: context.organizationId,
        eventType: 'PROJECT_BRIEF_APPROVED',
        aggregateType: 'project',
        aggregateId: projectId,
        payload: { actorUserId: context.actorId, playbookKey: playbook.key },
      })
      .catch(() => undefined);
    return NextResponse.json(
      { brief, playbook: { key: playbook.key, name: playbook.name }, memoryId: memory.id },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Project access denied.' }, { status: 403 });
    if (error instanceof Error && error.name === 'ZodError')
      return NextResponse.json({ error: 'That is not a complete brief.' }, { status: 400 });
    return NextResponse.json(
      {
        error: `The brief could not be approved. ${
          error instanceof Error ? error.message : 'Unknown failure.'
        }`,
      },
      { status: 500 },
    );
  }
}
