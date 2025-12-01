import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    const body = (await req.json().catch(() => ({}))) as { tenant_id?: string | null };
    const session = await requireTenantSession(body.tenant_id);
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.REGULATION_SYNC_TOKEN) {
    return NextResponse.json({ error: '未配置 regulation-sync 函数' }, { status: 500 });
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/regulation-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.REGULATION_SYNC_TOKEN}`,
    },
    body: JSON.stringify({ tenant_id: tenantId }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }

  return NextResponse.json({ status: 'triggered' });
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('q')?.trim();
  const jurisdiction = req.nextUrl.searchParams.get('jurisdiction')?.trim();

  try {
    await requireTenantSession(); // 仅校验用户已登录
  } catch (error) {
    return handleAuthError(error);
  }

  const query = supabaseAdmin
    .from('regulations')
    .select('id,name,jurisdiction,effective_date,expiry_date,source_url, regulation_sections(id,section_no,text,tags)')
    .order('effective_date', { ascending: false })
    .limit(100);

  if (search) {
    query.or(`name.ilike.%${search}%,jurisdiction.ilike.%${search}%`);
  }
  if (jurisdiction) {
    query.eq('jurisdiction', jurisdiction);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ regulations: data ?? [] });
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
