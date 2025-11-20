import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ContractRow = {
  id: string;
  title: string;
  status: string;
  counterparty: string | null;
  created_at: string;
  risk_findings: { count: number }[];
};

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .select<ContractRow>('id, title, status, counterparty, created_at, risk_findings(count)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data ?? []).map((row) => ({
    ...row,
    risk_count: row.risk_findings?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ contracts: mapped });
}
