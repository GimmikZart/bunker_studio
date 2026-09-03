import { collectRun } from '@bunker-studio/agent-runtime';
import {
  designProposalRequestSchema,
  designVersionSchema,
  type DesignProposalRequest,
} from '@bunker-studio/contracts';
import { evaluateBudgetPolicies } from '@bunker-studio/core';
import { buildDesignPrompt, parseDesignDraft } from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import {
  getWebAgentRepository,
  getWebAgentRuntime,
  getWebOperationalRepository,
  type WebOperationalRepository,
} from '../_data';
import {
  createStaticDesignProposals,
  renderDesignProposals,
  type StaticDesignProposal,
} from './_designer';

const DEFAULT_DESIGN_ESTIMATED_COST = 0.02;

function designEstimatedCost(): number {
  const value = Number(process.env.DESIGN_PROPOSAL_ESTIMATED_COST ?? DEFAULT_DESIGN_ESTIMATED_COST);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DESIGN_ESTIMATED_COST;
}

/**
 * Asks the Designer agent for proposals, falling back to the deterministic
 * generator whenever the agent has no provider binding or returns something
 * that does not fit the contract. The fallback keeps the flow usable before any
 * provider is connected, and the caller cannot tell the difference structurally
 * because both paths render through the same escaped preview boundary.
 */
async function proposeDesigns(
  input: DesignProposalRequest,
  operations: WebOperationalRepository,
  organizationId: string,
  actorId: string,
): Promise<StaticDesignProposal[]> {
  try {
    const agents = await getWebAgentRepository();
    if (!agents) return createStaticDesignProposals(input);
    const designer = await agents.getAgent(input.designerAgentId, organizationId, actorId);
    const runtime = await getWebAgentRuntime(designer);
    if (!runtime) return createStaticDesignProposals(input);
    const runId = crypto.randomUUID();
    const estimatedCost = designEstimatedCost();
    const result = await collectRun(runtime, {
      agentId: designer.id,
      prompt: buildDesignPrompt({
        brief: input.brief,
        constraints: input.constraints,
        variantCount: input.variantCount,
      }),
      correlationId: runId,
      capabilities: {
        skills: designer.skills,
        tools: designer.tools,
        permissions: designer.permissions,
      },
    });
    await operations.addCost(
      {
        organizationId,
        amount: estimatedCost,
        occurredAt: new Date().toISOString(),
        provider: result.provider,
        model: designer.providerModelId,
        agentId: designer.id,
        runId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      actorId,
    );
    const draft = parseDesignDraft(result.text, input.variantCount);
    if (!draft.ok) return createStaticDesignProposals(input);
    return renderDesignProposals(draft.draft, input);
  } catch {
    return createStaticDesignProposals(input);
  }
}

export async function GET(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  const versions = await operations.listDesignVersions(organizationId, actorId);
  return NextResponse.json({
    versions: await Promise.all(
      versions.map(async (version) => ({
        ...version,
        previews: await operations.listDesignPreviews(organizationId, version.id, actorId),
      })),
    ),
  });
}

export async function POST(request: Request) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  if (!operations)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  if (!(await operations.getRole(organizationId, actorId)))
    return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
  try {
    const payload: unknown = await request.json();
    const proposalRequest = designProposalRequestSchema.safeParse(payload);
    if (proposalRequest.success) {
      const budget = evaluateBudgetPolicies({
        policies: await operations.listBudgetPolicies(organizationId, actorId),
        entries: await operations.listCosts(organizationId, actorId),
        estimatedCost: designEstimatedCost(),
        context: { agentId: proposalRequest.data.designerAgentId },
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
                  ? 'Design work blocked by hard budget'
                  : 'Design work requires budget approval',
              body: 'The Designer cannot propose variants until the budget policy is resolved.',
              deepLink: '/designs',
            },
            actorId,
          ),
        );
        return NextResponse.json(
          { error: 'Budget policy prevents requesting a design.', budget },
          { status: 409 },
        );
      }
      const proposals = await proposeDesigns(
        proposalRequest.data,
        operations,
        organizationId,
        actorId,
      );
      const existing = await operations.listDesignVersions(organizationId, actorId);
      const firstVersion = Math.max(0, ...existing.map((version) => version.version)) + 1;
      const versions = [];
      let designRequestId: string | undefined;
      for (const [index, proposal] of proposals.entries()) {
        const version = await operations.submitDesignVersion(
          organizationId,
          {
            version: firstVersion + index,
            spec: proposal.spec,
            rationale: proposal.rationale,
            previews: [proposal.preview],
            ...(designRequestId
              ? { designRequestId }
              : {
                  designRequest: {
                    designerAgentId: proposalRequest.data.designerAgentId,
                    brief: proposalRequest.data.brief,
                    ...(proposalRequest.data.projectId
                      ? { projectId: proposalRequest.data.projectId }
                      : {}),
                    ...(proposalRequest.data.taskId ? { taskId: proposalRequest.data.taskId } : {}),
                  },
                }),
          },
          actorId,
        );
        designRequestId = version.designRequestId;
        versions.push(version);
      }
      await operations
        .recordActivity({
          organizationId,
          eventType: 'DESIGN_PROPOSALS_CREATED',
          aggregateType: 'design_request',
          aggregateId: designRequestId ?? versions[0]!.id,
          payload: { actorUserId: actorId, variantCount: versions.length },
        })
        .catch(() => undefined);
      return NextResponse.json({ versions }, { status: 201 });
    }
    const input = designVersionSchema.parse(payload);
    const version = await operations.submitDesignVersion(
      organizationId,
      {
        version: input.versionNumber,
        spec: input.spec,
        rationale: input.rationale,
        previewArtifactIds: input.previewArtifactIds,
      },
      actorId,
    );
    return NextResponse.json({ version }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid design version payload.' }, { status: 400 });
  }
}
