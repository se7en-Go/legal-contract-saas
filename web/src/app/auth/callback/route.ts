import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  const redirectUrl = new URL(next, request.url);

  if (code) {
    try {
      const supabase = await createServerSupabase({ canWriteCookies: true });
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Supabase exchangeCodeForSession error:', error);
        redirectUrl.pathname = '/login';
        redirectUrl.searchParams.set('error', '登录链接已失效或已被使用，请重新请求。');
        return NextResponse.redirect(redirectUrl);
      }

      // 成功登录，添加调试日志
      console.log('✅ Auth callback successful, redirecting to:', redirectUrl.toString());

    } catch (err) {
      console.error('Unexpected error in auth callback:', err);
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('error', '登录过程中发生错误，请重试。');
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    console.warn('No code parameter found in auth callback');
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('error', '无效的登录链接。');
  }

  return NextResponse.redirect(redirectUrl);
}
