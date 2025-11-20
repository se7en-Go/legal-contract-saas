import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');
  const tenantParam = formData.get('tenantId');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 file 参数' }, { status: 400 });
  }

  const tenantField = typeof tenantParam === 'string' ? tenantParam.trim() : null;
  let tenantId: string;
  let userId: string;
  try {
    const session = await requireTenantSession(tenantField);
    tenantId = session.tenantId;
    userId = session.user.id;
  } catch (error) {
    return handleAuthError(error);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const tenantPrefix = tenantId.trim().replace(/[^a-zA-Z0-9-_]/g, '');
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'contract';
  const safeName = `${Date.now()}-${sanitizedName}`;
  const path = `${tenantPrefix}/${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(process.env.CONTRACTS_BUCKET ?? 'contracts')
    .upload(path, buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
      metadata: { tenant_id: tenantId, uploaded_by: userId },
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
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
