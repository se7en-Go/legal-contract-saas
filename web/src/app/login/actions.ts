'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    throw new Error('请输入邮箱地址');
  }
  const supabase = await createServerSupabase({ canWriteCookies: true });
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const params = new URLSearchParams();
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      throw new Error(error.message);
    }
    params.set('status', 'sent');
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '发送登录链接失败';
    const friendlyMessage = /only request this after/i.test(rawMessage)
      ? '操作过于频繁，请稍候几秒再请求登录链接。'
      : rawMessage;
    params.set('error', friendlyMessage);
  }
  const search = params.toString();
  redirect(`/login${search ? `?${search}` : ''}`);
}

export async function signOut() {
  const supabase = await createServerSupabase({ canWriteCookies: true });
  await supabase.auth.signOut();
  redirect('/login');
}
