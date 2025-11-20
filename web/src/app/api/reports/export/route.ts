import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const REPORTER_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/insight-reporter`
  : '';

export async function POST() {
  const supabase = createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  const tenantId = data.user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: '当前账号未绑定 tenant_id' }, { status: 400 });
  }

  const [contractsRes, tasksRes, risksRes] = await Promise.all([
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('tasks').select('id,status').eq('tenant_id', tenantId),
    supabase
      .from('risk_findings')
      .select('id,risk_level,clause:clauses!inner(contract_version:contract_versions!inner(contract:contracts!inner(tenant_id)))')
      .eq('clauses.contract_versions.contracts.tenant_id', tenantId),
  ]);

  if (contractsRes.error || tasksRes.error || risksRes.error) {
    return NextResponse.json({ error: '统计数据读取失败' }, { status: 500 });
  }

  type RiskRow = { risk_level: string };
  type TaskRow = { status: string };

  const risks = (risksRes.data ?? []) as RiskRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const totals = {
    contracts: contractsRes.count ?? 0,
    risks: risks.length,
    highRisks: risks.filter((r) => r.risk_level === 'high').length,
    openTasks: tasks.filter((t) => t.status !== 'completed').length,
  };

  if (!REPORTER_URL || !process.env.INSIGHT_REPORTER_TOKEN) {
    return NextResponse.json({ error: '尚未配置 Insight Reporter 函数' }, { status: 500 });
  }

  const response = await fetch(REPORTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.INSIGHT_REPORTER_TOKEN}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      data: {
        contracts: totals.contracts,
        risks: totals.risks,
        highRisks: totals.highRisks,
        openTasks: totals.openTasks,
        highlights: [
          { title: '任务队列', detail: `未完成 ${totals.openTasks} 条` },
          { title: '高风险', detail: `${totals.highRisks} 项需要复核` },
        ],
      },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }

  const dataJson = await response.json();
  return NextResponse.json({ markdown: dataJson.markdown });
}
