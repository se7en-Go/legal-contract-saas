import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  const tenantId = data.user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ notifications: [] });
  }

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50);
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ notifications: rows ?? [] });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  const tenantId = data.user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: '当前账号未绑定 tenant_id' }, { status: 400 });
  }

  const body = await req.json();
  const ids: string[] = body.ids ?? [];
  if (!ids.length) {
    return NextResponse.json({ error: 'ids 必填' }, { status: 400 });
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .eq('tenant_id', tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ updated: ids.length });
}
