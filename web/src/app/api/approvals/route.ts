import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

async function requireSession() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, user: null };
  }
  return { supabase, user: data.user };
}

export async function GET() {
  const { supabase, user } = await requireSession();
  if (!user) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ approvals: [] });
  }

  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ approvals: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireSession();
  if (!user) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: '当前账号未绑定 tenant_id' }, { status: 400 });
  }

  const body = await req.json();
  const { entity_type, entity_id, note } = body;
  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type 与 entity_id 必填' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('approvals')
    .insert({
      tenant_id: tenantId,
      entity_type,
      entity_id,
      note: note ?? null,
      assigned_to: user.id,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ approval: data });
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await requireSession();
  if (!user) {
    return NextResponse.json({ error: '未登录或会话失效' }, { status: 401 });
  }
  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: '当前账号未绑定 tenant_id' }, { status: 400 });
  }

  const body = await req.json();
  const { id, status, resolution, note } = body;
  if (!id) {
    return NextResponse.json({ error: 'id 必填' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('approvals')
    .update({
      status: status ?? 'approved',
      resolution: resolution ?? null,
      note: note ?? undefined,
      updated_at: new Date().toISOString(),
      assigned_to: user.id,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ approval: data });
}
