import { designProposalRequestSchema, designVersionSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../_auth';
import { getWebOperationalRepository } from '../_data';
import { createStaticDesignProposals } from './_designer';

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
      const proposals = createStaticDesignProposals(proposalRequest.data);
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
