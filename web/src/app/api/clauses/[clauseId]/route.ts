import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

type Params = {
  clauseId: string;
};

export async function PATCH(req: NextRequest, context: { params: Promise<{ clauseId: string }> }) {
  const { clauseId } = await context.params;
  if (!clauseId) {
    return NextResponse.json({ error: 'clauseId 必填' }, { status: 400 });
  }

  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const body = await req.json();
  const title = (body?.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  }

  const { data: clauseRow, error } = await supabaseAdmin
    .from('clauses')
    .select(
      `
      id,title,
      contract_version:contract_versions!inner(
        contract:contracts!inner(tenant_id)
      )
    `
    )
    .eq('id', clauseId)
    .single();

  if (error && error.code === 'PGRST116') {
    return NextResponse.json({ error: '未找到条款' }, { status: 404 });
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rowTenantId = clauseRow.contract_version?.contract?.[0]?.tenant_id;
  if (rowTenantId !== tenantId) {
    return NextResponse.json({ error: '无权编辑其他租户的条款' }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin.from('clauses').update({ title }).eq('id', clauseId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ id: clauseId, title });
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
