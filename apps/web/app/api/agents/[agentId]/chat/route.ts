import { collectRun, FakeRuntime } from '@bunker-studio/agent-runtime';
import { chatMessageSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../../_auth';
import { tenantStore } from '../../../_store';

export async function POST(request: Request, context: { params: Promise<{ agentId: string }> }) {
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  const actorId = await resolveActorId(request);
  const { agentId } = await context.params;
  if (!organizationId || !actorId)
    return NextResponse.json(
      { error: 'Authentication and organization are required.' },
      { status: 401 },
    );
  try {
    const agent = tenantStore.getAgent(agentId, organizationId, actorId);
    const input = chatMessageSchema.parse(await request.json());
    const result = await collectRun(new FakeRuntime({}), {
      agentId: agent.id,
      prompt: `${agent.title}: ${input.content}`,
      sessionId: input.sessionId,
      correlationId: crypto.randomUUID(),
    });
    return NextResponse.json({
      message: { role: 'assistant', content: result.text },
      sessionId: result.sessionId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError')
      return NextResponse.json({ error: 'Agent access denied.' }, { status: 403 });
    return NextResponse.json({ error: 'Invalid chat message.' }, { status: 400 });
  }
}
