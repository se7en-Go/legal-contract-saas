import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';
import { RiskLevel, getRiskLevelAliases, normalizeRiskLevel } from '@/lib/risk-level';

const riskFindingSelect = `
  id,risk_level,risk_type,description,recommendation,regulation_refs,resolution_status,resolved_at,created_at,
  clause:clauses!inner(
    id,clause_no,title,contract_version_id,
    contract_version:contract_versions!inner(
      id,version_no,
      contract:contracts!inner(id,title,counterparty,tenant_id)
    )
  )
`;

export async function PATCH(req: NextRequest) {
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const body = await req.json();
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  const status: string | undefined = body?.status;
  if (!ids.length) {
    return NextResponse.json({ error: 'ids 必填' }, { status: 400 });
  }
  if (!status || !['open', 'resolved'].includes(status)) {
    return NextResponse.json({ error: 'status 必须为 open/resolved' }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('risk_findings')
    .select(
      `id, clause:clauses!inner(contract_version:contract_versions!inner(contract:contracts!inner(tenant_id)))`
    )
    .in('id', ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allowedIds = (rows ?? [])
    .filter((row) => {
      const typedRow = row as unknown as {
        id: string;
        clause?: {
          contract_version?: {
            contract?: {
              tenant_id: string;
            };
          };
        };
      };
      return typedRow.clause?.contract_version?.contract?.tenant_id === tenantId;
    })
    .map((row) => row.id);

  if (!allowedIds.length) {
    return NextResponse.json({ error: '无可更新的记录' }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('risk_findings')
    .update({ resolution_status: status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
    .in('id', allowedIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ updated: allowedIds.length });
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search')?.trim() ?? '';
  const level = req.nextUrl.searchParams.get('level') ?? 'all';
  const statusFilter = req.nextUrl.searchParams.get('status') ?? 'all';
  const contractId = req.nextUrl.searchParams.get('contractId') ?? undefined;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? 1));
  const pageSize = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('pageSize') ?? 20)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let tenantId: string;
  try {
    const session = await requireTenantSession();
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const applyCommonFilters = (
    builder: any,
    options: { includeLevelFilter?: boolean } = {}
  ) => {
    const { includeLevelFilter = true } = options;
    builder.eq('clauses.contract_versions.contracts.tenant_id', tenantId);
    if (search) {
      builder.or(`description.ilike.%${search}%,risk_type.ilike.%${search}%,recommendation.ilike.%${search}%`);
    }
    if (statusFilter && statusFilter !== 'all') {
      builder.eq('resolution_status', statusFilter);
    }
    if (contractId) {
      builder.eq('clauses.contract_versions.contract_id', contractId);
    }
    if (includeLevelFilter && level && level !== 'all') {
      const canonical = getRiskLevelAliases(level as RiskLevel);
      builder.in('risk_level', canonical);
    }
    return builder;
  };

  const query = applyCommonFilters(
    supabaseAdmin
      .from('risk_findings')
      .select(riskFindingSelect, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const countQuerySelect = `
    id,
    clause:clauses!inner(
      contract_version:contract_versions!inner(
        contract:contracts!inner(tenant_id)
      )
    )
  `;

  const countQuery = async (targetLevel?: RiskLevel) => {
    const buildBase = (options?: { head?: boolean }) => {
      const builder = applyCommonFilters(
        supabaseAdmin
          .from('risk_findings')
          .select(countQuerySelect, { count: 'exact', head: options?.head ?? false }),
        { includeLevelFilter: false }
      );
      if (targetLevel) {
        builder.in('risk_level', getRiskLevelAliases(targetLevel));
      }
      return builder;
    };

    const primary = await buildBase({ head: true });
    if (primary.error) {
      throw primary.error;
    }
    if (typeof primary.count === 'number') {
      return primary.count;
    }

    const fallback = await buildBase()
      .limit(2000);
    if (fallback.error) {
      throw fallback.error;
    }
    return fallback.count ?? fallback.data?.length ?? 0;
  };

  let stats = { total: count ?? data?.length ?? 0, high: 0, medium: 0, low: 0 };
  try {
    const [totalCount, highCount, mediumCount, lowCount] = await Promise.all([
      countQuery(),
      countQuery('high'),
      countQuery('medium'),
      countQuery('low'),
    ]);
    stats = {
      total: totalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    };
  } catch (countError) {
    console.error('Failed to fetch risk counts', countError);
  }

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    clause_id: row.clause.id,
    clause_title: row.clause.title,
    contract_version_id: row.clause.contract_version.id,
    contract_version_no: row.clause.contract_version.version_no,
    contract_id: row.clause.contract_version.contract.id,
    contract_title: row.clause.contract_version.contract.title,
    contract_counterparty: row.clause.contract_version.contract.counterparty,
    risk_level: normalizeRiskLevel(row.risk_level) ?? row.risk_level,
    summary: row.description,
    recommendation: row.recommendation,
    resolution_status: row.resolution_status ?? 'open',
    created_at: row.created_at,
  }));

  return NextResponse.json({
    risks: mapped,
    total: count ?? mapped.length,
    page,
    pageSize,
    stats,
  });
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
