import { approveDesignVersion } from '@bunker-studio/core';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { listDesignVersions, replaceDesignVersions, tenantStore } from '../../../_store';

export async function POST(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  if (tenantStore.getRole(organizationId, actorId) !== 'OWNER')
    return NextResponse.json({ error: 'Owner approval is required.' }, { status: 403 });
  const { versionId } = await context.params;
  try {
    const versions = listDesignVersions(organizationId);
    const approved = approveDesignVersion(versions, versionId, actorId);
    replaceDesignVersions(organizationId, approved);
    return NextResponse.json({ versions: approved });
  } catch {
    return NextResponse.json(
      { error: 'Only a submitted design can be approved.' },
      { status: 409 },
    );
  }
}
