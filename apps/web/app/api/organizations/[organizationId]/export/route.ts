import { exportOrganization } from '@bunker-studio/db';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../../../_data';

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const actorId = await resolveActorId(request);
  const { organizationId } = await context.params;
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const tenancy = await getWebTenancyRepository();
  const agents = await getWebAgentRepository();
  const operations = await getWebOperationalRepository();
  if (!tenancy || !agents || !operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  try {
    const organization = (await tenancy.listOrganizations(actorId)).find(
      (item) => item.id === organizationId,
    );
    if (!organization)
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    const [teams, projects, registeredAgents, memories, conversations, tasks] = await Promise.all([
      tenancy.listTeams(organizationId, actorId),
      tenancy.listProjects(organizationId, actorId),
      agents.listAgents(organizationId, actorId),
      operations.listMemories(organizationId, actorId),
      operations.listConversations(organizationId, actorId),
      operations.listTasks(organizationId, actorId),
    ]);
    const assignments = (
      await Promise.all(
        registeredAgents.map((agent) =>
          agents.listAgentAssignments(agent.id, organizationId, actorId),
        ),
      )
    ).flat();
    const pack = exportOrganization({
      organization: { id: organization.id, name: organization.name },
      teams: teams.map(({ id, name }) => ({ id, name })),
      projects: projects.map(({ id, name, defaultTeamId, teamIds }) => ({
        id,
        name,
        ...(defaultTeamId ? { teamId: defaultTeamId } : {}),
        ...(teamIds.length ? { teamIds } : {}),
      })),
      agents: registeredAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        roleKey: agent.roleKey,
        title: agent.title,
        personality: agent.personality,
        avatarAssetId: agent.avatarAssetId,
        skills: agent.skills,
        tools: agent.tools,
        permissions: agent.permissions,
        providerBindingId: agent.providerBindingId,
      })),
      assignments: assignments.map(({ id, agentId, teamId, projectId, reportsToAgentId }) => ({
        id,
        agentId,
        teamId,
        projectId,
        reportsToAgentId,
      })),
      memories,
      conversations: conversations.map(({ id, agentId, externalSessionId, messages }) => ({
        id,
        agentId,
        externalSessionId,
        messages,
      })),
      tasks: tasks.map(
        ({
          id,
          projectId,
          title,
          description,
          taskType,
          state,
          dependencies,
          readScope,
          writeScope,
          requiredCapability,
          parallelGroupId,
          approvedDesignVersionId,
          estimatedCost,
          priority,
        }) => ({
          id,
          projectId,
          title,
          description,
          taskType,
          state,
          dependencies,
          readScope,
          writeScope,
          ...(requiredCapability ? { requiredCapability } : {}),
          ...(parallelGroupId ? { parallelGroupId } : {}),
          ...(approvedDesignVersionId ? { approvedDesignVersionId } : {}),
          estimatedCost,
          priority,
        }),
      ),
    });
    return new NextResponse(JSON.stringify(pack), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="bunker-studio-${organization.slug}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  }
}
