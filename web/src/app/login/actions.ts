'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    throw new Error('请输入邮箱地址');
  }
  const supabase = createServerSupabase();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      flowType: 'pkce',
    },
  });
  if (error) {
    throw new Error(error.message);
  }
  redirect('/login?status=sent');
}

export async function signOut() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
