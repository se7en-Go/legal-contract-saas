import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');
  const tenantId = formData.get('tenantId');

  if (!(file instanceof File) || typeof tenantId !== 'string' || !tenantId) {
    return NextResponse.json({ error: 'file 和 tenantId 必填' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = ${Date.now()}-;
  const path = 	enant//;

  const { error } = await supabaseAdmin.storage
    .from(process.env.CONTRACTS_BUCKET ?? 'contracts')
    .upload(path, buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
      metadata: { tenant_id: tenantId },
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
