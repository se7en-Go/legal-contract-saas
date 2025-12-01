import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';
import { RiskLevel, normalizeRiskLevel } from '@/lib/risk-level';

export async function GET() {
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const contractsPromise = supabaseAdmin.from('contracts').select('id,status,created_at').eq('tenant_id', tenantId);

  const risksPromise = supabaseAdmin
    .from('risk_findings')
    .select('id,risk_level,created_at,clauses!inner(contract_version_id,contract_versions!inner(contract_id,contracts!inner(tenant_id)))')
    .eq('clauses.contract_versions.contracts.tenant_id', tenantId);

  const tasksPromise = supabaseAdmin
    .from('tasks')
    .select('id,task_type,status,progress,error,last_error,retry_count,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(15);

  const notificationsPromise = supabaseAdmin
    .from('notifications')
    .select('id,entity,message,severity,metadata,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(15);

  const attemptsPromise = supabaseAdmin
    .from('task_attempts')
    .select('id,status,created_at,tasks!inner(tenant_id)')
    .eq('tasks.tenant_id', tenantId)
    .gte('created_at', since);

  const completionPromise = supabaseAdmin
    .from('tasks')
    .select('id,created_at,updated_at,status')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('updated_at', since);

  const [contractsRes, risksRes, tasksRes, notificationsRes, attemptsRes, completionRes] = await Promise.all([
    contractsPromise,
    risksPromise,
    tasksPromise,
    notificationsPromise,
    attemptsPromise,
    completionPromise,
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
  if (attemptsRes.error) {
    return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });
  }
  if (completionRes.error) {
    return NextResponse.json({ error: completionRes.error.message }, { status: 500 });
  }

  const contracts = contractsRes.data ?? [];
  const risks = risksRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const notifications = notificationsRes.data ?? [];
  const attempts = attemptsRes.data ?? [];
  const completed = completionRes.data ?? [];

  const contractStatus = contracts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const normalizedCounters: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
  const riskLevel = risks.reduce<Record<string, number>>((acc, row) => {
    const normalized = normalizeRiskLevel(row.risk_level);
    const level = normalized ?? row.risk_level ?? 'unknown';
    acc[level] = (acc[level] ?? 0) + 1;
    if (normalized) {
      normalizedCounters[normalized] += 1;
    }
    return acc;
  }, {});

  const openTasks = tasks.filter((task) => task.status !== 'completed');

  const succeededAttempts = attempts.filter((attempt) => attempt.status === 'completed').length;
  const totalAttempts = attempts.length;
  const averageCompletionSeconds = (() => {
    const durations = completed
      .map((task) => {
        const created = new Date(task.created_at).getTime();
        const updated = new Date(task.updated_at ?? task.created_at).getTime();
        return Math.max(0, updated - created);
      })
      .filter((value) => value > 0);
    if (!durations.length) return null;
    const total = durations.reduce((sum, value) => sum + value, 0);
    return total / durations.length / 1000;
  })();

  return NextResponse.json({
    totals: {
      contracts: contracts.length,
      risks: risks.length,
      highRisks: normalizedCounters.high,
      openTasks: openTasks.length,
    },
    statuses: {
      contractStatus,
      riskLevel,
    },
    sla: {
      windowHours: 24,
      successRate: totalAttempts ? succeededAttempts / totalAttempts : null,
      averageCompletionSeconds,
      totalAttempts,
      succeededAttempts,
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
