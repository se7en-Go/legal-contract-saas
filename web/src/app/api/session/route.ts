import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ user: null });
  }
  const { email, user_metadata } = data.user;
  return NextResponse.json({
    user: {
      id: data.user.id,
      email,
      tenant_id: user_metadata?.tenant_id ?? null,
      role: user_metadata?.role ?? 'member',
    },
  });
}
