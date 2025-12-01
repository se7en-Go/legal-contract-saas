import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const body = await req.json();
  const taskId: string | undefined = body?.taskId;
  if (!taskId) {
    return NextResponse.json({ error: 'taskId 必填' }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabaseAdmin
    .from('tasks')
    .select('id, tenant_id, status')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }
  if (!task || task.tenant_id !== tenantId) {
    return NextResponse.json({ error: '未找到任务或无权限' }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('tasks')
    .update({ status: 'queued', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ taskId, status: 'queued' });
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
