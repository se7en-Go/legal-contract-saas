import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const REPORTER_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/insight-reporter`
  : '';

const RANGE_MAP: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  const tenantId = data.user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: '当前账号未绑定 tenant_id' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const dateRange: string = body?.dateRange ?? '30d';
  const contractType: string | null = body?.contractType && body.contractType !== 'all' ? body.contractType : null;
  const contractId: string | null = body?.contractId ?? null;
  const sinceDays = RANGE_MAP[dateRange] ?? RANGE_MAP['30d'];
  const since = sinceDays ? new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString() : null;

  // 创建 Service Role 客户端绕过 RLS
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false }
    }
  );

  const allContractsQuery = serviceClient
    .from('contracts')
    .select('id,created_at')
    .eq('tenant_id', tenantId);

  const contractsQuery = supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (contractType) contractsQuery.eq('metadata->>type', contractType);
  if (contractId) contractsQuery.eq('id', contractId);
  if (since) contractsQuery.gte('created_at', since);

  const tasksQuery = supabase.from('tasks').select('id,status,created_at').eq('tenant_id', tenantId);
  if (since) tasksQuery.gte('created_at', since);

  // 使用Service Role客户端进行风险查询，绕过RLS限制
  let risksData: any[] = [];
  let risksError: any = null;

  try {
    const { data: contractsForRisks, error: contractsError } = await serviceClient
      .from('contracts')
      .select('id')
      .eq('tenant_id', tenantId);

    if (contractsError) {
      risksError = contractsError;
    } else if (contractsForRisks && contractsForRisks.length > 0) {
      const contractIds = contractsForRisks.map(c => c.id);

      const { data: versions, error: versionsError } = await serviceClient
        .from('contract_versions')
        .select('id')
        .in('contract_id', contractIds);

      if (versionsError) {
        risksError = versionsError;
      } else if (versions && versions.length > 0) {
        const versionIds = versions.map(v => v.id);

        const { data: clauses, error: clauseError } = await serviceClient
          .from('clauses')
          .select('id')
          .in('contract_version_id', versionIds);

        if (clauseError) {
          risksError = clauseError;
        } else {
          const clauseIdList = clauses?.map(c => c.id) || [];
          if (clauseIdList.length > 0) {
            let risksQuery = serviceClient
              .from('risk_findings')
              .select('id,risk_level,created_at')
              .in('clause_id', clauseIdList);

            if (since) {
              risksQuery = risksQuery.gte('created_at', since);
            }

            const { data: risks, error } = await risksQuery;
            risksError = error;
            risksData = risks || [];
          }
        }
      }
    }
  } catch (error) {
    risksError = error;
  }

  const [allContractsRes, contractsRes, tasksRes, dummyRisksRes] = await Promise.all([allContractsQuery, contractsQuery, tasksQuery, Promise.resolve({ data: [] })]);

  if (contractsRes.error || tasksRes.error || risksError) {
    return NextResponse.json({
      error: '统计数据读取失败',
      details: {
        contracts: contractsRes.error?.message,
        tasks: tasksRes.error?.message,
        risks: risksError?.message
      }
    }, { status: 500 });
  }

  type RiskRow = { risk_level: string };
  type TaskRow = { status: string };

  const risks = risksData as RiskRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const allContracts = allContractsRes.data ?? [];

  // 添加详细调试信息
  console.log('=== Detailed Debug Info ===');
  console.log('tenantId:', tenantId);
  console.log('dateRange:', dateRange);
  console.log('since:', since);
  console.log('sinceDays:', sinceDays);

  console.log('Service Role client contracts query:', {
    error: allContractsRes.error,
    length: allContractsRes.data?.length,
    items: allContractsRes.data?.map(c => ({ id: c.id, created_at: c.created_at }))
  });

  console.log('RLS contracts query result:', {
    error: contractsRes.error,
    count: contractsRes.count,
    status: contractsRes.status
  });

  console.log('Tasks query result:', {
    error: tasksRes.error,
    length: tasksRes.data?.length,
    status: tasksRes.status
  });

  console.log('Risks query result:', {
    error: risksError,
    length: risks.length,
    sample: risks.slice(0, 3)
  });
  console.log('High risks count:', risks.filter((r) => r.risk_level === 'high' || r.risk_level === 'High' || r.risk_level === '高').length);

  const totals = {
    contracts: contractsRes.count ?? 0,
    risks: risks.length,
    highRisks: risks.filter((r) => r.risk_level === 'high' || r.risk_level === 'High' || r.risk_level === '高').length,
    openTasks: tasks.filter((t) => t.status !== 'completed').length,
    allContractsCount: allContracts.length, // 总合同数（不受时间限制）
  };

  if (!REPORTER_URL || !process.env.INSIGHT_REPORTER_TOKEN) {
    return NextResponse.json({ error: '尚未配置 Insight Reporter 函数' }, { status: 500 });
  }

  const response = await fetch(REPORTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'x-insight-reporter-token': process.env.INSIGHT_REPORTER_TOKEN,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      filters: {
        date_range: dateRange,
        contract_type: contractType,
        contract_id: contractId,
      },
      data: {
        contracts: totals.contracts,
        allContractsCount: totals.allContractsCount,
        risks: totals.risks,
        highRisks: totals.highRisks,
        openTasks: totals.openTasks,
        highlights: [
          { title: '任务队列', detail: `未完成 ${totals.openTasks} 条` },
          { title: '高风险', detail: `${totals.highRisks} 项需要复核` },
          ...(totals.allContractsCount > 0 ? [{ title: '总合同数', detail: `${totals.allContractsCount} 份合同` }] : []),
        ],
        debug: {
          tenantId,
          dateRange,
          since,
          allContractsCount: totals.allContractsCount,
          filteredContractsCount: totals.contracts,
        }
      },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }

  const dataJson = await response.json();
  return NextResponse.json({ markdown: dataJson.markdown });
}
