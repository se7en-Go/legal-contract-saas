import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

const RISK_ANALYZER_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/risk-analyzer`
  : '';

/**
 * Rerun Request Interface
 * @interface RerunRequest
 * @property {string} contractVersionId - Contract version ID to analyze
 * @property {'party_a' | 'party_b' | 'neutral'} [user_position] - User's position for position-aware analysis
 */
interface RerunRequest {
  contractVersionId: string;
  user_position?: 'party_a' | 'party_b' | 'neutral';
}

export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const body = await req.json();
  const contractVersionId: string | undefined = body?.contractVersionId;
  const userPosition: 'party_a' | 'party_b' | 'neutral' | undefined = body?.user_position;

  if (!contractVersionId) {
    return NextResponse.json({ error: 'contractVersionId 必填' }, { status: 400 });
  }

  // Validate user_position if provided
  if (userPosition && !['party_a', 'party_b', 'neutral'].includes(userPosition)) {
    return NextResponse.json(
      { error: 'user_position 必须是 party_a、party_b 或 neutral 之一' },
      { status: 400 }
    );
  }

  const { data: version, error } = await supabaseAdmin
    .from('contract_versions')
    .select('id, contract:contracts!inner(id, tenant_id)')
    .eq('id', contractVersionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Type assertion for the nested query result
  const versionRow = version as unknown as {
    id: string;
    contract?: {
      id: string;
      tenant_id: string;
    } | null;
  } | null;

  if (!versionRow?.contract || versionRow.contract.tenant_id !== tenantId) {
    return NextResponse.json({ error: '无权限访问该版本' }, { status: 404 });
  }

  if (!RISK_ANALYZER_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: '尚未配置 risk-analyzer 函数' }, { status: 500 });
  }

  // Prepare request body with position-aware analysis support
  const requestBody: Record<string, string> = {
    tenant_id: tenantId,
    contract_version_id: contractVersionId,
  };

  // Add user_position if provided
  if (userPosition) {
    requestBody.user_position = userPosition;
  }

  const response = await fetch(RISK_ANALYZER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }

  return NextResponse.json({
    status: 'queued',
    message: userPosition
      ? `已提交分析任务，立场：${getPositionLabel(userPosition)}`
      : '已提交分析任务'
  });
}

/**
 * Get Chinese label for position
 */
function getPositionLabel(position: 'party_a' | 'party_b' | 'neutral'): string {
  const labels = {
    party_a: '甲方',
    party_b: '乙方',
    neutral: '中立'
  };
  return labels[position];
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
