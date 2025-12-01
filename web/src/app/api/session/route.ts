import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { resolveTenantIdForUser } from '@/lib/tenant-binding';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ user: null });
    }

    const { email, user_metadata, id: userId } = data.user;
    const preferred =
      typeof user_metadata?.tenant_id === 'string' ? user_metadata.tenant_id.trim() : null;
    const tenantId = await resolveTenantIdForUser(data.user, preferred);

    return NextResponse.json({
      user: {
        id: userId,
        email,
        tenant_id: tenantId,
        role: user_metadata?.role ?? 'member',
      },
    });
  } catch (error) {
    console.error('Failed to resolve session', error);
    return NextResponse.json({ error: '无法获取租户信息' }, { status: 500 });
  }
}
