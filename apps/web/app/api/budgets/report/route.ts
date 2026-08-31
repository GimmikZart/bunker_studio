import { weeklyCostReport, forecastMonthlyCost, nextWeeklyReportAt } from '@bunker-studio/core';
import { reportScheduleSchema } from '@bunker-studio/contracts';
import { NextResponse } from 'next/server';
import { resolveActorId } from '../../_auth';
import { getWebOperationalRepository } from '../../_data';

async function load(request: Request) {
  const actorId = await resolveActorId(request);
  const organizationId = request.headers.get('x-bunker-organization-id')?.trim();
  if (!actorId || !organizationId)
    return {
      actorId: null,
      organizationId: null,
      operations: null,
      response: NextResponse.json(
        { error: 'Authentication and organization are required.' },
        { status: 401 },
      ),
    };
  const operations = await getWebOperationalRepository();
  if (!operations)
    return {
      actorId,
      organizationId,
      operations: null,
      response: NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 }),
    };
  const role = await operations.getRole(organizationId, actorId);
  if (!role)
    return {
      actorId,
      organizationId,
      operations,
      response: NextResponse.json({ error: 'Organization access denied.' }, { status: 403 }),
    };
  return { actorId, organizationId, operations, response: null };
}

export async function GET(request: Request) {
  const access = await load(request);
  if (access.response) return access.response;
  if (!access.operations || !access.organizationId || !access.actorId)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const entries = await access.operations.listCosts(access.organizationId, access.actorId);
  return NextResponse.json({
    schedule: await access.operations.getReportSchedule(access.organizationId, access.actorId),
    weekly: weeklyCostReport(entries),
    monthlyForecast: forecastMonthlyCost(entries),
    reports: await access.operations.listBudgetReports(access.organizationId, access.actorId),
  });
}

export async function PUT(request: Request) {
  const access = await load(request);
  if (access.response) return access.response;
  if (!access.operations || !access.organizationId || !access.actorId)
    return NextResponse.json({ error: 'Persistence is not configured.' }, { status: 503 });
  const role = await access.operations.getRole(access.organizationId, access.actorId);
  if (!role || !['OWNER', 'ADMIN'].includes(role))
    return NextResponse.json(
      { error: 'Owner or admin report configuration is required.' },
      { status: 403 },
    );
  try {
    const input = reportScheduleSchema.parse(await request.json());
    const schedule = await access.operations.saveReportSchedule(
      access.organizationId,
      {
        ...input,
        nextRunAt: nextWeeklyReportAt(input).toISOString(),
      },
      access.actorId,
    );
    return NextResponse.json({ schedule });
  } catch {
    return NextResponse.json({ error: 'Invalid weekly report schedule.' }, { status: 400 });
  }
}
