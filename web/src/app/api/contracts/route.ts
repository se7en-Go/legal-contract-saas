import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ForbiddenError, UnauthorizedError, requireTenantSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const tenantParam = req.nextUrl.searchParams.get('tenantId');
  const statusFilter = req.nextUrl.searchParams.get('status');
  const search = req.nextUrl.searchParams.get('search')?.trim();
  const counterparty = req.nextUrl.searchParams.get('counterparty')?.trim();
  const contractType = req.nextUrl.searchParams.get('contractType')?.trim();
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? 0);
  const minRisk = Number(req.nextUrl.searchParams.get('minRisk') ?? 0);

  let tenantId: string;

  try {
    const session = await requireTenantSession(tenantParam);
    tenantId = session.tenantId;
  } catch (error) {
    return handleAuthError(error);
  }

  const contractsQuery = supabaseAdmin
    .from('contracts')
    .select('id, title, status, counterparty, created_at, metadata')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    contractsQuery.eq('status', statusFilter);
  }
  if (search) {
    contractsQuery.or(`title.ilike.%${search}%,counterparty.ilike.%${search}%`);
  }
  if (counterparty) {
    contractsQuery.ilike('counterparty', `%${counterparty}%`);
  }
  if (contractType && contractType !== 'all') {
    contractsQuery.eq('metadata->>type', contractType);
  }
  if (limitParam > 0) {
    contractsQuery.limit(limitParam);
  }

  const { data: contractRows, error } = await contractsQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contracts = contractRows ?? [];
  if (!contracts.length) {
    return NextResponse.json({ contracts: [] });
  }

  const contractIds = contracts.map((row) => row.id);
  const { data: riskRows, error: riskError } = await supabaseAdmin
    .from('risk_findings')
    .select('id, clause:clauses!inner(contract_version:contract_versions!inner(contract_id))')
    .in('clauses.contract_versions.contract_id', contractIds);

  if (riskError) {
    return NextResponse.json({ error: riskError.message }, { status: 500 });
  }

  const riskCountMap = new Map<string, number>();
  for (const row of riskRows ?? []) {
    // Type assertion for nested join structure using unknown as intermediate
    const riskRow = row as unknown as {
      clause?: {
        contract_version?: {
          contract_id: string;
        } | null;
      } | null;
    };
    const contractId = riskRow.clause?.contract_version?.contract_id;
    if (!contractId) continue;
    riskCountMap.set(contractId, (riskCountMap.get(contractId) ?? 0) + 1);
  }

  const mapped = contracts.map((row) => {
    const contractTypeValue = typeof row.metadata?.type === 'string' ? (row.metadata?.type as string) : null;
    return {
      ...row,
      contract_type: contractTypeValue,
      risk_count: riskCountMap.get(row.id) ?? 0,
    };
  });

  const filteredContracts = minRisk > 0 ? mapped.filter((row) => row.risk_count >= minRisk) : mapped;

  return NextResponse.json({ contracts: filteredContracts });
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
