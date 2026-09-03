import { collectRun } from '@bunker-studio/agent-runtime';
import { leadPlanGenerationSchema } from '@bunker-studio/contracts';
import { evaluateBudgetPolicies, remainingHardBudget } from '@bunker-studio/core';
import {
  buildLeadPlanPrompt,
  parseLeadPlanProposal,
  validateLeadPlanProposal,
} from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import {
  getWebAgentRepository,
  getWebAgentRuntime,
  getWebOperationalRepository,
  getWebTenancyRepository,
} from '../../../_data';

const DEFAULT_PLAN_ESTIMATED_COST = 0.05;
const MAX_EXISTING_TASK_TITLES = 40;

function planEstimatedCost(): number {
  const value = Number(process.env.LEAD_PLAN_ESTIMATED_COST ?? DEFAULT_PLAN_ESTIMATED_COST);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_PLAN_ESTIMATED_COST;
}

/**
 * Asks the Lead to decompose a goal and returns the result as a proposal.
 *
 * Nothing is persisted here: the plan becomes work only when it is submitted to
 * `POST /api/workflows/plan`, which keeps the human gate on what the studio
 * actually commits to. Every structural rule is enforced deterministically, so
 * a model cannot widen a write scope, skip the design gate or overspend.
 */
export async function POST(request: Request) {
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
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });

  let input: ReturnType<typeof leadPlanGenerationSchema.parse>;
  try {
    input = leadPlanGenerationSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid plan request.' }, { status: 400 });
  }

  try {
    const project = (await tenancy.listProjects(organizationId, actorId)).find(
      (candidate) => candidate.id === input.projectId,
    );
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    const lead = await agents.getAgent(input.leadAgentId, organizationId, actorId);
    const runtime = await getWebAgentRuntime(lead);
    if (!runtime)
      return NextResponse.json({ error: 'Provider runtime is not configured.' }, { status: 503 });

    const policies = await operations.listBudgetPolicies(organizationId, actorId);
    const costs = await operations.listCosts(organizationId, actorId);
    const runId = crypto.randomUUID();
    const estimatedCost = planEstimatedCost();
    const budgetContext = { projectId: input.projectId, agentId: lead.id, runId };
    const budget = evaluateBudgetPolicies({
      policies,
      entries: costs,
      estimatedCost,
      context: budgetContext,
    });
    if (budget.decision !== 'ALLOW') {
      await Promise.resolve(
        operations.addNotification(
          {
            organizationId,
            userId: actorId,
            category: 'BUDGET',
            severity: budget.decision === 'HARD_STOP' ? 'CRITICAL' : 'HIGH',
            title:
              budget.decision === 'HARD_STOP'
                ? 'Planning blocked by hard budget'
                : 'Planning requires budget approval',
            body: `The Lead cannot plan "${project.name}" until the budget policy is resolved.`,
            deepLink: `/tasks`,
          },
          actorId,
        ),
      );
      return NextResponse.json(
        { error: 'Budget policy prevents planning this project.', budget },
        { status: 409 },
      );
    }

    const teamAgents = await agents.listAgents(organizationId, actorId);
    const approvedDesignVersionIds = (await operations.listDesignVersions(organizationId, actorId))
      .filter((version) => version.status === 'APPROVED')
      .map((version) => version.id);
    const existingTaskTitles = (await operations.listTasks(organizationId, actorId))
      .filter((task) => task.projectId === input.projectId)
      .slice(0, MAX_EXISTING_TASK_TITLES)
      .map((task) => task.title);
    const teamCapabilities = [...new Set(teamAgents.flatMap((agent) => agent.skills))];
    const remainingBudget = remainingHardBudget({
      policies,
      entries: costs,
      context: budgetContext,
    });

    const result = await collectRun(runtime, {
      agentId: lead.id,
      prompt: buildLeadPlanPrompt({
        goal: input.goal,
        constraints: input.constraints,
        teamCapabilities,
        approvedDesignVersionIds,
        remainingBudget,
        existingTaskTitles,
      }),
      correlationId: runId,
      capabilities: { skills: lead.skills, tools: lead.tools, permissions: lead.permissions },
    });
    await operations.addCost(
      {
        organizationId,
        amount: estimatedCost,
        occurredAt: new Date().toISOString(),
        provider: result.provider,
        model: lead.providerModelId,
        agentId: lead.id,
        runId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      actorId,
    );

    const parsed = parseLeadPlanProposal(result.text);
    if (!parsed.ok)
      return NextResponse.json(
        { error: 'The Lead did not return a usable plan.', reasons: parsed.reasons },
        { status: 422 },
      );
    const validated = validateLeadPlanProposal(parsed.plan, {
      approvedDesignVersionIds,
      remainingBudget,
      teamCapabilities,
    });
    if (!validated.ok)
      return NextResponse.json(
        { error: 'The proposed plan violates the studio rules.', reasons: validated.reasons },
        { status: 422 },
      );

    await operations.recordActivity({
      organizationId,
      eventType: 'WORKFLOW_PLAN_PROPOSED',
      aggregateType: 'project',
      aggregateId: input.projectId,
      payload: {
        actorUserId: actorId,
        leadAgentId: lead.id,
        taskCount: validated.plan.tasks.length,
      },
    });
    return NextResponse.json({
      plan: validated.plan,
      order: validated.order,
      leadAgentId: lead.id,
      projectId: input.projectId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Agent access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'The Lead could not produce a plan.' }, { status: 502 });
  }
}
