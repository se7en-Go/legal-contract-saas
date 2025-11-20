import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function GET() {
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const contractsPromise = supabaseAdmin.from('contracts').select('id,status,created_at').eq('tenant_id', tenantId);

  const risksPromise = supabaseAdmin
    .from('risk_findings')
    .select('id,risk_level,created_at,clauses!inner(contract_version_id,contract_versions!inner(contract_id,contracts!inner(tenant_id)))')
    .eq('clauses.contract_versions.contracts.tenant_id', tenantId);

  const tasksPromise = supabaseAdmin
    .from('tasks')
    .select('id,task_type,status,progress,error,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(15);

  const notificationsPromise = supabaseAdmin
    .from('notifications')
    .select('id,entity,message,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);

  const [contractsRes, risksRes, tasksRes, notificationsRes] = await Promise.all([
    contractsPromise,
    risksPromise,
    tasksPromise,
    notificationsPromise,
  ]);

  if (contractsRes.error) {
    return NextResponse.json({ error: contractsRes.error.message }, { status: 500 });
  }
  if (risksRes.error) {
    return NextResponse.json({ error: risksRes.error.message }, { status: 500 });
  }
  if (tasksRes.error) {
    return NextResponse.json({ error: tasksRes.error.message }, { status: 500 });
  }
  if (notificationsRes.error) {
    return NextResponse.json({ error: notificationsRes.error.message }, { status: 500 });
  }

  const contracts = contractsRes.data ?? [];
  const risks = risksRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const notifications = notificationsRes.data ?? [];

  const contractStatus = contracts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const riskLevel = risks.reduce<Record<string, number>>((acc, row) => {
    const level = row.risk_level ?? 'unknown';
    acc[level] = (acc[level] ?? 0) + 1;
    return acc;
  }, {});

  const openTasks = tasks.filter((task) => task.status !== 'completed');

  return NextResponse.json({
    totals: {
      contracts: contracts.length,
      risks: risks.length,
      highRisks: riskLevel['high'] ?? 0,
      openTasks: openTasks.length,
    },
    statuses: {
      contractStatus,
      riskLevel,
    },
    tasks,
    notifications,
  });
}

function handleAuthError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ error: '未知错误' }, { status: 500 });
}
