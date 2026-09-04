import { collectRun } from '@bunker-studio/agent-runtime';
import { reviewGenerationSchema, type VerificationEvidence } from '@bunker-studio/contracts';
import { canWrite, evaluateBudgetPolicies } from '@bunker-studio/core';
import { decryptSecret, type EncryptedSecret } from '@bunker-studio/db';
import { createGitHubApi } from '@bunker-studio/git';
import {
  buildReviewPrompt,
  composeReviewReport,
  parseReviewDraft,
} from '@bunker-studio/orchestration';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import {
  getWebAgentRepository,
  getWebAgentRuntime,
  getWebOperationalRepository,
} from '../../_data';
import { createWorkerServiceSupabaseClient } from '../../_supabase';

const DEFAULT_REVIEW_ESTIMATED_COST = 0.05;

function reviewEstimatedCost(): number {
  const value = Number(process.env.REVIEW_ESTIMATED_COST ?? DEFAULT_REVIEW_ESTIMATED_COST);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_REVIEW_ESTIMATED_COST;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Repository lookup returned invalid data.');
  return value as Record<string, unknown>;
}

/**
 * Asks the Reviewer agent to review one published candidate.
 *
 * The Reviewer reports findings; it never decides the outcome. `PASS` or
 * `FIX_REQUIRED` is derived from the findings, and the review is always
 * recorded against the exact commit that was sent, so a persuasive answer
 * cannot clear a candidate that still has blocking problems.
 */
export async function POST(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  const operations = await getWebOperationalRepository();
  const agents = await getWebAgentRepository();
  if (!operations || !agents)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });

  let input: ReturnType<typeof reviewGenerationSchema.parse>;
  try {
    input = reviewGenerationSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid review request.' }, { status: 400 });
  }

  try {
    const role = await operations.getRole(organizationId, actorId);
    if (!role) return NextResponse.json({ error: 'Organization access denied.' }, { status: 403 });
    if (!canWrite(role))
      return NextResponse.json(
        { error: 'Owner or admin access is required to run a review.' },
        { status: 403 },
      );

    const task = (await operations.listTasks(organizationId, actorId)).find(
      (candidate) => candidate.id === input.taskId,
    );
    if (!task || task.projectId !== input.projectId)
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    if (!task.candidateCommitSha || !task.candidatePullRequestNumber)
      return NextResponse.json(
        { error: 'The task has no published candidate to review.' },
        { status: 409 },
      );

    const reviewer = await agents.getAgent(input.reviewerAgentId, organizationId, actorId);
    const runtime = await getWebAgentRuntime(reviewer);
    if (!runtime)
      return NextResponse.json({ error: 'Provider runtime is not configured.' }, { status: 503 });

    const correlationId = crypto.randomUUID();
    const estimatedCost = reviewEstimatedCost();
    const budget = evaluateBudgetPolicies({
      policies: await operations.listBudgetPolicies(organizationId, actorId),
      entries: await operations.listCosts(organizationId, actorId),
      estimatedCost,
      context: {
        projectId: input.projectId,
        taskId: task.id,
        agentId: reviewer.id,
        runId: correlationId,
      },
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
                ? 'Review blocked by hard budget'
                : 'Review requires budget approval',
            body: `"${task.title}" cannot be reviewed until the budget policy is resolved.`,
            deepLink: '/tasks',
          },
          actorId,
        ),
      );
      return NextResponse.json(
        { error: 'Budget policy prevents running this review.', budget },
        { status: 409 },
      );
    }

    // The diff comes from the repository credential, which only the service
    // client can decrypt; a review without the candidate diff would be a guess.
    const client = createWorkerServiceSupabaseClient();
    const masterKey = process.env.STUDIO_MASTER_KEY;
    if (!client || !masterKey)
      return NextResponse.json(
        { error: 'A connected repository is required to review a candidate.' },
        { status: 503 },
      );
    const repositoryResponse = await client
      .from('repo_connections')
      .select('provider_type, repo_owner, repo_name, status, encrypted_auth_blob')
      .eq('project_id', task.projectId)
      .eq('organization_id', organizationId)
      .eq('status', 'CONNECTED')
      .maybeSingle();
    if (repositoryResponse.error || !repositoryResponse.data)
      return NextResponse.json(
        { error: 'Connected GitHub repository not found.' },
        { status: 409 },
      );
    const repository = record(repositoryResponse.data);
    if (
      repository.provider_type !== 'GITHUB' ||
      typeof repository.repo_owner !== 'string' ||
      typeof repository.repo_name !== 'string' ||
      !repository.encrypted_auth_blob ||
      typeof repository.encrypted_auth_blob !== 'object'
    )
      return NextResponse.json({ error: 'GitHub repository is not ready.' }, { status: 409 });
    const token = decryptSecret(
      record(repository.encrypted_auth_blob) as EncryptedSecret,
      masterKey,
    );
    const files = await createGitHubApi({ token }).listPullRequestFiles({
      repository: { owner: repository.repo_owner, name: repository.repo_name },
      number: task.candidatePullRequestNumber,
    });

    const verification: VerificationEvidence[] = Array.isArray(task.workerResult?.verification)
      ? (task.workerResult.verification as VerificationEvidence[])
      : [];
    // The ledger references a run by foreign key, so the run row exists first.
    const run = await operations.startAgentRun(
      { organizationId, agentId: reviewer.id, correlationId },
      actorId,
    );
    let result: Awaited<ReturnType<typeof collectRun>>;
    try {
      result = await collectRun(runtime, {
        agentId: reviewer.id,
        prompt: buildReviewPrompt({
          reviewerTitle: reviewer.title,
          taskTitle: task.title,
          taskDescription: task.description,
          definitionOfDone: task.definitionOfDone ?? [],
          candidateCommitSha: task.candidateCommitSha,
          files,
          verification,
        }),
        correlationId,
        capabilities: {
          skills: reviewer.skills,
          tools: reviewer.tools,
          permissions: reviewer.permissions,
        },
      });
    } catch (error) {
      await Promise.resolve(
        operations.finishAgentRun(organizationId, run.id, 'FAILED', undefined, actorId),
      ).catch(() => undefined);
      throw error;
    }
    await Promise.resolve(
      operations.finishAgentRun(organizationId, run.id, 'COMPLETED', result.sessionId, actorId),
    ).catch(() => undefined);
    await operations.addCost(
      {
        organizationId,
        amount: estimatedCost,
        occurredAt: new Date().toISOString(),
        provider: result.provider,
        model: reviewer.providerModelId,
        agentId: reviewer.id,
        taskId: task.id,
        projectId: task.projectId,
        runId: run.id,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      actorId,
    );

    const draft = parseReviewDraft(result.text);
    if (!draft.ok)
      return NextResponse.json(
        { error: 'The Reviewer did not return a usable report.', reason: draft.reason },
        { status: 422 },
      );
    const composed = composeReviewReport(draft.draft, task.candidateCommitSha);
    const review = await operations.addReview(
      {
        organizationId,
        projectId: task.projectId,
        taskId: task.id,
        reviewerAgentId: reviewer.id,
        candidateSha: composed.candidateSha,
        status: composed.status,
        summary: composed.summary,
        findings: composed.findings,
      },
      actorId,
    );
    await operations.recordActivity({
      organizationId,
      eventType: 'REVIEW_GENERATED',
      aggregateType: 'task',
      aggregateId: task.id,
      payload: {
        actorUserId: actorId,
        reviewerAgentId: reviewer.id,
        status: composed.status,
        findingCount: composed.findings.length,
      },
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Agent access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'The review could not be completed.' }, { status: 502 });
  }
}
