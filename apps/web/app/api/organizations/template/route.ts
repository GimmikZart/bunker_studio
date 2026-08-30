import { roleTemplates } from '@bunker-studio/core';
import { NextResponse } from 'next/server';

/**
 * Returns infrastructure defaults only. This endpoint is intentionally
 * unauthenticated because the response contains no tenant data or secrets.
 */
export async function GET() {
  return NextResponse.json({
    manifest: {
      schemaVersion: 1,
      kind: 'VIRGIN_TEMPLATE',
      exportedAt: new Date().toISOString(),
    },
    config: {
      supportedAutonomyModes: ['MANUAL', 'SUPERVISED', 'AUTONOMOUS', 'LAB'],
      notificationCategories: ['APPROVAL', 'SECURITY', 'BUDGET', 'QUOTA', 'WORKFLOW'],
      providerConnections: [],
    },
    agentTemplates: roleTemplates.map((template) => ({
      roleKey: template.roleKey,
      title: template.title,
      modelTier: template.modelTier,
    })),
    data: {
      organizations: [],
      users: [],
      memories: [],
      conversations: [],
      secrets: [],
    },
  });
}
