import { importOrganization } from '@bunker-studio/db';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import {
  getWebAgentRepository,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../../_data';
import { parseOrganizationExport } from '../portability';

export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  if (!actorId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const tenancy = await getWebTenancyRepository();
  const agents = await getWebAgentRepository();
  const operations = await getWebOperationalRepository();
  if (!tenancy || !agents || !operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  let pack;
  try {
    pack = parseOrganizationExport(await request.json());
  } catch {
    pack = null;
  }
  if (!pack) return NextResponse.json({ error: 'Invalid organization export.' }, { status: 400 });
  try {
    const remapped = importOrganization(pack);
    const organization = await tenancy.createOrganization({
      name: `${pack.organization.name} (imported)`,
      ownerUserId: actorId,
    });
    const teamIds = new Map<string, string>();
    for (const team of pack.teams) {
      const created = await tenancy.createTeam({
        organizationId: organization.id,
        actorUserId: actorId,
        name: team.name,
      });
      teamIds.set(team.id, created.id);
    }
    const projectIds = new Map<string, string>();
    for (const project of pack.projects) {
      const created = await tenancy.createProject({
        organizationId: organization.id,
        actorUserId: actorId,
        name: project.name,
        teamId: project.teamId ? teamIds.get(project.teamId) : undefined,
      });
      projectIds.set(project.id, created.id);
    }
    let tasksImported = 0;
    for (const task of pack.tasks) {
      const projectId = projectIds.get(task.projectId);
      const id = remapped.idMap.get(task.id);
      const dependencies = task.dependencies.map((dependency) => remapped.idMap.get(dependency));
      if (!projectId || !id || dependencies.some((dependency) => !dependency))
        throw new Error('Task relationship cannot be remapped.');
      await operations.createTask(
        {
          id,
          organizationId: organization.id,
          projectId,
          title: task.title,
          description: task.description,
          taskType: task.taskType as 'FRONTEND' | 'BACKEND' | 'DESIGN' | 'TEST' | 'DOCS' | 'REVIEW',
          dependencies: dependencies as string[],
          writeScope: task.writeScope,
          estimatedCost: task.estimatedCost,
          priority: task.priority,
        },
        actorId,
      );
      tasksImported += 1;
    }
    const agentIds = new Map<string, string>();
    for (const agent of pack.agents) {
      const created = await agents.createAgent({
        organizationId: organization.id,
        actorUserId: actorId,
        name: agent.name,
        roleKey: agent.roleKey ?? 'imported',
        title: agent.title ?? agent.name,
        personality: agent.personality ?? {},
        providerBindingId: 'REQUIRES_REAUTH',
      });
      agentIds.set(agent.id, created.id);
    }
    let memoriesImported = 0;
    for (const memory of pack.memories) {
      await operations.addMemory(
        organization.id,
        {
          content: memory.content,
          type: memory.type,
          importance: memory.importance,
          projectId: memory.projectId ? projectIds.get(memory.projectId) : undefined,
          sourceId: memory.sourceId,
        },
        actorId,
      );
      memoriesImported += 1;
    }
    let conversationsImported = 0;
    for (const conversation of pack.conversations) {
      const agentId = conversation.agentId ? agentIds.get(conversation.agentId) : undefined;
      if (!agentId) continue;
      await operations.importConversation(
        {
          organizationId: organization.id,
          agentId,
          externalSessionId: conversation.externalSessionId ?? `import-${crypto.randomUUID()}`,
          messages: conversation.messages,
        },
        actorId,
      );
      conversationsImported += 1;
    }
    return NextResponse.json(
      {
        organization,
        imported: {
          teams: teamIds.size,
          projects: projectIds.size,
          agents: agentIds.size,
          tasks: tasksImported,
          memories: memoriesImported,
          conversations: conversationsImported,
        },
        providerStatus: remapped.providerStatus,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Organization import failed.' }, { status: 400 });
  }
}
