import { specStageSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { advanceProject } from '../../../../_conductor';
import { engagementContext } from '../../../../_engagement';
import { SPEC_TASK_TITLE, approvedBrief, briefAsGoal, repositoryWriter } from '../../../../_stages';

/** A slug that is safe as a file name and recognisable as the project. */
function slugOf(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'project'
  );
}

/**
 * Turns the approved brief into the document the rest of the work answers to.
 *
 * It is an ordinary task: same write scope, same verification, same branch and
 * pull request as any other change. The specification is not a special artefact
 * the studio keeps to itself — it lands in the repository, where the people and
 * the agents both look for it.
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await routeContext.params;
  const context = await engagementContext(request, projectId);
  if (!context.ok) return context.response;
  const { organizationId, actorId, operations, agents, project } = context;

  let input: ReturnType<typeof specStageSchema.parse>;
  try {
    input = specStageSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        error:
          'This stage writes to your repository, so it needs the verification commands to run there — including one security check.',
      },
      { status: 400 },
    );
  }
  if (!input.verificationCommands.some((command) => command.kind === 'SECURITY'))
    return NextResponse.json(
      { error: 'A task that writes to the repository needs a baseline security check.' },
      { status: 400 },
    );

  try {
    const brief = await approvedBrief({ projectId, organizationId, actorId, operations });
    if (!brief)
      return NextResponse.json(
        {
          error:
            'No brief has been approved for this project. Talk to the Lead first, and approve what it understood.',
        },
        { status: 409 },
      );

    const existing = (await operations.listTasks(organizationId, actorId)).find(
      (task) => task.projectId === projectId && task.title === SPEC_TASK_TITLE,
    );
    if (existing)
      return NextResponse.json(
        { error: 'The specification is already being written.', task: existing },
        { status: 409 },
      );

    const repository = await Promise.resolve(
      operations.getRepository(projectId, organizationId, actorId),
    ).catch(() => null);
    if (!repository || repository.status !== 'CONNECTED')
      return NextResponse.json(
        {
          error:
            'Connect a GitHub repository to this project first: the specification is written into it, on its own branch.',
        },
        { status: 409 },
      );

    const writer = await repositoryWriter({ projectId, organizationId, actorId, agents });
    if (!writer)
      return NextResponse.json(
        {
          error:
            'No agent on this project can reach the repository. Give one the repository runtime, or put one who has it on the project.',
        },
        { status: 409 },
      );

    const path = `docs/specs/${slugOf(project.name)}.md`;
    const task = await operations.createTask(
      {
        organizationId,
        projectId,
        assignedAgentId: writer.id,
        title: SPEC_TASK_TITLE,
        description: [
          'Write the technical specification this project will be built against.',
          '',
          `Put it at ${path}. Also keep docs/state/CURRENT.md and docs/state/NEXT.md up to date,`,
          'so whoever picks this project up next — person or agent — can see where it stands',
          'without reading the whole history.',
          '',
          'The agreed brief:',
          briefAsGoal(brief),
          ...(brief.openPoints.length
            ? [
                '',
                'Still undecided, and the document must say so rather than choose:',
                ...brief.openPoints.map((point) => `- ${point}`),
              ]
            : []),
          '',
          'Describe what will be built and how it will be verified. Do not change any code.',
        ].join('\n'),
        taskType: 'DOCS',
        dependencies: [],
        readScope: ['docs'],
        writeScope: ['docs'],
        verificationCommands: input.verificationCommands,
        definitionOfDone: [
          `${path} exists and describes the agreed scope.`,
          'What was excluded from scope is still excluded.',
          'Open points are recorded as open, not decided.',
        ],
        estimatedCost: input.estimatedCost,
        priority: 10,
      },
      actorId,
    );

    await operations
      .recordActivity({
        organizationId,
        eventType: 'PROJECT_SPEC_REQUESTED',
        aggregateType: 'project',
        aggregateId: projectId,
        payload: { actorUserId: actorId, taskId: task.id, path },
      })
      .catch(() => undefined);

    // The studio starts it if it can, like any other work.
    const advanced = await advanceProject({
      project,
      organizationId,
      actorId,
      operations,
      agents,
    }).catch(() => null);
    return NextResponse.json(
      { task, path, writer, ...(advanced ? { advanced } : {}) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Project access denied.' }, { status: 403 });
    return NextResponse.json(
      {
        error: `The specification could not be started. ${
          error instanceof Error ? error.message : 'Unknown failure.'
        }`,
      },
      { status: 500 },
    );
  }
}
