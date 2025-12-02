import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  // 修复：使用绝对URL构建重定向目标
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/[\n\r]/g, '') || requestUrl.origin;
  const redirectUrl = new URL(next, baseUrl);

  // 添加详细的调试信息（仅开发环境）
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 Auth callback debug:');
    console.log('  - Full URL:', requestUrl.toString());
    console.log('  - Code:', code ? `${code.substring(0, 8)}...` : 'MISSING');
    console.log('  - Next:', next);
    console.log('  - Origin:', requestUrl.origin);
    console.log('  - Environment:', process.env.NODE_ENV);
    console.log('  - Site URL:', process.env.NEXT_PUBLIC_SITE_URL);
  }

  if (code) {
    try {
      const supabase = await createServerSupabase({ canWriteCookies: true });

      if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 Attempting to exchange code for session...');
      }
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('❌ Supabase exchangeCodeForSession error:', {
            message: error.message,
            status: error.status,
            code: error.code,
            codeProvided: !!code,
            codeLength: code?.length || 0
          });
        }

        // 根据错误类型提供更具体的错误信息
        let errorMessage = '登录链接已失效或已被使用，请重新请求。';

        if (error.message.includes('Invalid refresh token')) {
          errorMessage = '登录令牌无效，请重新获取登录链接。';
        } else if (error.message.includes('expired')) {
          errorMessage = '登录链接已过期，请重新获取登录链接。';
        } else if (error.message.includes('Invalid code')) {
          errorMessage = '登录链接无效，请重新获取登录链接。';
        } else if (error.message.includes('401') || error.status === 401) {
          errorMessage = '认证失败，请检查链接是否正确。';
        } else if (error.message.includes('unauthorized_client')) {
          errorMessage = '客户端认证失败，请联系技术支持。';
        }

        console.error('💡 Detailed error info:', {
          errorMessage,
          originalError: error.message,
          errorCode: error.status
        });

        redirectUrl.pathname = '/login';
        redirectUrl.searchParams.set('error', errorMessage);
        return NextResponse.redirect(redirectUrl);
      }

      // 成功登录，添加调试日志（仅开发环境）
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Auth callback successful!');
        console.log('  - Session established:', !!data.session);
        console.log('  - User ID:', data.session?.user?.id);
        console.log('  - Email:', data.session?.user?.email);
        console.log('  - Redirecting to:', redirectUrl.toString());
      }

    } catch (err) {
      console.error('❌ Unexpected error in auth callback:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });

      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('error', '登录过程中发生错误，请重试。');
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    console.warn('⚠️ No code parameter found in auth callback');
    console.log('  - Available search params:', Array.from(requestUrl.searchParams.keys()));

    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('error', '无效的登录链接。');
  }

  return NextResponse.redirect(redirectUrl);
}
