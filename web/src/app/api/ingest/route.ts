import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { tenant_id: bodyTenantId, storage_path, title, counterparty, metadata } = body;
  if (!storage_path || !title) {
    return NextResponse.json({ error: 'title 与 storage_path 必填' }, { status: 400 });
  }

  let tenantId: string;
  let userId: string;
  try {
    const session = await requireTenantSession(bodyTenantId);
    tenantId = session.tenantId;
    userId = session.user.id;
  } catch (error) {
    return handleAuthError(error);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase 环境变量未配置' }, { status: 500 });
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/ingest-doc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      storage_path,
      title,
      counterparty,
      metadata: { ...metadata, requested_by: userId },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: data?.error || data }, { status: response.status });
  }
  return NextResponse.json(data);
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
