import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const tenantId = data.user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: '用户未绑定 tenant_id' }, { status: 400 });
  }

  try {
    // 检查所有表的数据
    const [contractsRes, tasksRes, risksRes, clausesRes] = await Promise.all([
      supabase.from('contracts').select('id, title, metadata, created_at').eq('tenant_id', tenantId),
      supabase.from('tasks').select('id, status, created_at').eq('tenant_id', tenantId),
      supabase.from('risk_findings').select('id, risk_level, created_at').eq('tenant_id', tenantId),
      supabase.from('clauses').select('id, content, created_at').eq('tenant_id', tenantId),
    ]);

    return NextResponse.json({
      tenantId,
      user: data.user.email,
      data: {
        contracts: {
          count: contractsRes.data?.length || 0,
          items: contractsRes.data || []
        },
        tasks: {
          count: tasksRes.data?.length || 0,
          items: tasksRes.data || []
        },
        risks: {
          count: risksRes.data?.length || 0,
          items: risksRes.data || []
        },
        clauses: {
          count: clausesRes.data?.length || 0,
          items: clausesRes.data || []
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: '数据查询失败',
      details: (error as Error).message
    }, { status: 500 });
  }
}