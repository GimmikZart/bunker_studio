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
    const [teams, projects, registeredAgents, memories, conversations] = await Promise.all([
      tenancy.listTeams(organizationId, actorId),
      tenancy.listProjects(organizationId, actorId),
      agents.listAgents(organizationId, actorId),
      operations.listMemories(organizationId, actorId),
      operations.listConversations(organizationId, actorId),
    ]);
    const pack = exportOrganization({
      organization: { id: organization.id, name: organization.name },
      teams: teams.map(({ id, name }) => ({ id, name })),
      projects: projects.map(({ id, name, defaultTeamId }) => ({
        id,
        name,
        ...(defaultTeamId ? { teamId: defaultTeamId } : {}),
      })),
      agents: registeredAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        roleKey: agent.roleKey,
        title: agent.title,
        personality: agent.personality,
        providerBindingId: agent.providerBindingId,
      })),
      memories,
      conversations: conversations.map(({ id, agentId, externalSessionId, messages }) => ({
        id,
        agentId,
        externalSessionId,
        messages,
      })),
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
