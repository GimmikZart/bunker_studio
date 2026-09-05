import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../_data';

/** Task states that mean the project still has work moving. */
const ACTIVE_TASK_STATES = new Set([
  'READY',
  'QUEUED',
  'RUNNING',
  'WAITING_DEPENDENCY',
  'WAITING_APPROVAL',
  'WAITING_PROVIDER_QUOTA',
  'WAITING_BUDGET_APPROVAL',
  'IMPLEMENTED',
  'VERIFYING',
  'REVIEW_PENDING',
  'FIX_REQUIRED',
]);
const BLOCKED_TASK_STATES = new Set(['BLOCKED', 'FAILED_RETRYABLE', 'FAILED_FINAL']);

/**
 * One request behind the project cards. A card is only useful if it shows what
 * the project actually has — repository, agents, work in flight — so the page
 * assembles that here rather than fanning out from the browser.
 */
export async function GET(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const tenancy = await getWebTenancyRepository();
  const agentStore = await getWebAgentRepository();
  const operations = await getWebOperationalRepository();
  if (!tenancy || !agentStore || !operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const projects = await tenancy.listProjects(organizationId, actorId);
    // Nothing here is swallowed: a card showing zero agents because a query
    // failed would be a lie, and the failure would stay invisible.
    const [repositories, agents, assignments, tasks] = await Promise.all([
      operations.listRepositories(organizationId, actorId),
      agentStore.listAgents(organizationId, actorId),
      agentStore.listAssignments(organizationId, actorId),
      operations.listTasks(organizationId, actorId),
    ]);
    return NextResponse.json({
      projects: projects.map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const repository = repositories.find((item) => item.projectId === project.id) ?? null;
        const assignedAgentIds = new Set(
          assignments
            .filter((assignment) => assignment.projectId === project.id)
            .map((assignment) => assignment.agentId),
        );
        for (const task of projectTasks)
          if (task.assignedAgentId) assignedAgentIds.add(task.assignedAgentId);
        return {
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
          status: project.status,
          autonomyMode: project.autonomyMode,
          createdAt: project.createdAt,
          repository: repository
            ? {
                owner: repository.owner,
                name: repository.name,
                defaultBranch: repository.defaultBranch,
                status: repository.status,
              }
            : null,
          agents: agents
            .filter((agent) => assignedAgentIds.has(agent.id) && !agent.archivedAt)
            .map((agent) => ({
              id: agent.id,
              name: agent.name,
              title: agent.title,
              roleKey: agent.roleKey,
            })),
          tasks: {
            total: projectTasks.length,
            active: projectTasks.filter((task) => ACTIVE_TASK_STATES.has(task.state)).length,
            done: projectTasks.filter((task) => task.state === 'DONE').length,
            blocked: projectTasks.filter((task) => BLOCKED_TASK_STATES.has(task.state)).length,
          },
        };
      }),
    });
  } catch (error) {
    // Only a refusal is a refusal. Reporting every failure as 403 hid a stale
    // build and a missing migration behind "access denied" for days.
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    return NextResponse.json(
      {
        error: `The projects could not be read. ${
          error instanceof Error ? error.message : 'Unknown failure.'
        }`,
      },
      { status: 500 },
    );
  }
}
