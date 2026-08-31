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
    const projectIdsInPack = new Set(pack.projects.map((project) => project.id));
    const teamIdsInPack = new Set(pack.teams.map((team) => team.id));
    const taskIdsInPack = new Set(pack.tasks.map((task) => task.id));
    const agentIdsInPack = new Set(pack.agents.map((agent) => agent.id));
    if (
      pack.projects.some(
        (project) =>
          (project.teamId !== undefined && !teamIdsInPack.has(project.teamId)) ||
          (project.teamIds ?? []).some((teamId) => !teamIdsInPack.has(teamId)),
      ) ||
      pack.assignments.some(
        (assignment) =>
          !agentIdsInPack.has(assignment.agentId) ||
          (assignment.teamId !== undefined &&
            assignment.teamId !== null &&
            !teamIdsInPack.has(assignment.teamId)) ||
          (assignment.projectId !== undefined &&
            assignment.projectId !== null &&
            !projectIdsInPack.has(assignment.projectId)) ||
          (assignment.reportsToAgentId !== undefined &&
            assignment.reportsToAgentId !== null &&
            !agentIdsInPack.has(assignment.reportsToAgentId)),
      ) ||
      pack.tasks.some(
        (task) =>
          !projectIdsInPack.has(task.projectId) ||
          task.dependencies.some((dependency) => !taskIdsInPack.has(dependency)),
      )
    )
      throw new Error('Task dependency graph references missing entities.');
    const pendingTaskIds = new Set(taskIdsInPack);
    while (pendingTaskIds.size) {
      const completedBefore = pendingTaskIds.size;
      for (const task of pack.tasks) {
        if (
          pendingTaskIds.has(task.id) &&
          task.dependencies.every((dependency) => !pendingTaskIds.has(dependency))
        )
          pendingTaskIds.delete(task.id);
      }
      if (pendingTaskIds.size === completedBefore)
        throw new Error('Task dependency graph contains a cycle.');
    }
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
        teamIds: project.teamIds
          ?.map((teamId) => teamIds.get(teamId))
          .filter((id): id is string => Boolean(id)),
      });
      projectIds.set(project.id, created.id);
    }
    let tasksImported = 0;
    const pendingTasks = [...pack.tasks];
    const importedTaskIds = new Set<string>();
    while (pendingTasks.length) {
      const taskIndex = pendingTasks.findIndex((candidate) =>
        candidate.dependencies.every((dependency) => importedTaskIds.has(dependency)),
      );
      if (taskIndex < 0) throw new Error('Task dependency graph cannot be remapped.');
      const task = pendingTasks.splice(taskIndex, 1)[0]!;
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
          readScope: task.readScope ?? [],
          writeScope: task.writeScope,
          ...(task.requiredCapability ? { requiredCapability: task.requiredCapability } : {}),
          ...(task.parallelGroupId ? { parallelGroupId: task.parallelGroupId } : {}),
          estimatedCost: task.estimatedCost,
          priority: task.priority,
        },
        actorId,
      );
      importedTaskIds.add(task.id);
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
        avatarAssetId: agent.avatarAssetId ?? null,
        skills: agent.skills ?? [],
        tools: agent.tools ?? [],
        permissions: agent.permissions ?? [],
        providerBindingId: 'REQUIRES_REAUTH',
      });
      agentIds.set(agent.id, created.id);
    }
    let assignmentsImported = 0;
    for (const assignment of pack.assignments) {
      const agentId = agentIds.get(assignment.agentId);
      const teamId = assignment.teamId ? teamIds.get(assignment.teamId) : undefined;
      const projectId = assignment.projectId ? projectIds.get(assignment.projectId) : undefined;
      const reportsToAgentId = assignment.reportsToAgentId
        ? agentIds.get(assignment.reportsToAgentId)
        : undefined;
      if (!agentId || (!teamId && !projectId)) throw new Error('Assignment cannot be remapped.');
      await agents.createAgentAssignment({
        organizationId: organization.id,
        actorUserId: actorId,
        agentId,
        teamId,
        projectId,
        reportsToAgentId,
      });
      assignmentsImported += 1;
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
          assignments: assignmentsImported,
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
