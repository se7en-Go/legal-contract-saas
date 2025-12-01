import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: '缺少 SUPABASE_SERVICE_ROLE_KEY 配置' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.functions.invoke('ingest-doc', {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: {
      tenant_id: tenantId,
      storage_path,
      title,
      counterparty,
      metadata: { ...metadata, requested_by: userId },
    },
  });

  if (error) {
    console.error('ingest-doc failed', error);
    const formatted = normalizeFunctionError(error);
    return NextResponse.json({ error: formatted.message }, { status: formatted.status });
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

function normalizeFunctionError(error: unknown) {
  const fallback = { status: 500, message: 'Edge Function 调用失败' };
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const context = (error as { context?: { response?: { status?: number; body?: unknown } } }).context;
  const response = context?.response;
  let message = (error as { message?: string }).message ?? fallback.message;
  const status = response?.status ?? fallback.status;

  if (response?.body) {
    const body = response.body;
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error) {
          message = parsed.error;
        }
      } catch {
        message = body;
      }
    } else if (typeof body === 'object') {
      const maybeMessage = (body as { error?: string }).error;
      if (maybeMessage) {
        message = maybeMessage;
      }
    }
  }

  return { status, message };
}
