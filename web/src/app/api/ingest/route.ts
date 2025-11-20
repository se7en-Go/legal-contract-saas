import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { tenant_id, storage_path, title, counterparty, metadata } = body;
  if (!tenant_id || !storage_path || !title) {
    return NextResponse.json({ error: 'tenant_id, title, storage_path required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase environment not configured' }, { status: 500 });
  }

  const response = await fetch(${supabaseUrl}/functions/v1/ingest-doc, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: Bearer ,
    },
    body: JSON.stringify({ tenant_id, storage_path, title, counterparty, metadata }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: data?.error || data }, { status: response.status });
  }
  return NextResponse.json(data);
}
