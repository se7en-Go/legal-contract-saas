import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectUrl = new URL('/', request.url);

  if (code) {
    const supabase = await createServerSupabase({ canWriteCookies: true });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Supabase exchangeCodeForSession error:', error);
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('error', '登录链接已失效或已被使用，请重新请求。');
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(redirectUrl);
}
