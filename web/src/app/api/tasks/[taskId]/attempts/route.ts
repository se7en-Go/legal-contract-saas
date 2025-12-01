import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function GET(_: NextRequest, context: { params: { taskId: string } | Promise<{ taskId: string }> }) {
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const params = 'then' in context.params ? await context.params : context.params;
  const { taskId } = params;
  if (!taskId) {
    return NextResponse.json({ error: 'taskId 缺失' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('task_attempts')
    .select('id, attempt_no, status, message, created_at, tasks!inner(tenant_id)')
    .eq('task_id', taskId)
    .eq('tasks.tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const attempts = (data ?? []).map((row) => ({
    id: row.id,
    attempt_no: row.attempt_no,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
  }));

  return NextResponse.json({ attempts });
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
