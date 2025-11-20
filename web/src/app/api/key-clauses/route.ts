import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? undefined;
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const query = supabaseAdmin
    .from('key_clauses')
    .select(
      `
      id,category,summary,attributes,created_at,
      clause:clauses(id,clause_no,title),
      contract_version:contract_versions!inner(
        id,version_no,
        contract:contracts!inner(id,title,counterparty,tenant_id)
      )
    `
    )
    .eq('contract_versions.contracts.tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (category) {
    query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ clauses: data ?? [] });
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
