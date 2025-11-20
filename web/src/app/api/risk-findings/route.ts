import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search')?.trim() ?? '';
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const query = supabaseAdmin
    .from('risk_findings')
    .select(
      `
      id,risk_level,risk_type,description,recommendation,regulation_refs,created_at,
      clause:clauses!inner(
        id,clause_no,title,contract_version_id,
        contract_version:contract_versions!inner(
          id,version_no,
          contract:contracts!inner(id,title,counterparty,tenant_id)
        )
      )
    `
    )
    .eq('clauses.contract_versions.contracts.tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (search) {
    query.or(`description.ilike.%${search}%,risk_type.ilike.%${search}%,recommendation.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ risks: data ?? [] });
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
