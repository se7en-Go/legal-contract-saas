import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);

    console.log('🔍 Supabase debug endpoint called');

    // 测试环境变量
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABABASE_URL ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV,
    };

    // 清理后的URL
    const cleanSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/[\n\r]/g, '');
    const cleanSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/[\n\r]/g, '');
    const cleanSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/[\n\r]/g, '');

    console.log('🧹 Clean URLs:', {
      supabaseUrl: cleanSupababaseUrl?.substring(0, 50) + '...',
      siteUrl: cleanSiteUrl,
      supabaseKey: cleanSupababaseKey ? cleanSupababaseKey.substring(0, 20) + '...' : null
    });

    if (!cleanSupabaseUrl || !cleanSupabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing required environment variables',
        envVars,
        cleanUrls: {
          supabaseUrl: cleanSupababaseUrl,
          supabaseKey: cleanSupabaseKey,
          siteUrl: cleanSiteUrl
        }
      }, { status: 500 });
    }

    // 测试Supabase连接
    const supabase = await createServerSupabase({ canWriteCookies: false });

    console.log('🔄 Testing Supabase connection...');

    // 测试基本连接
    const { data: connectionTest, error: connectionError } = await supabase
      .from('_health_check')
      .select('count')
      .limit(1);

    console.log('📊 Connection test result:', { connectionTest, connectionError });

    // 测试认证服务
    console.log('🔐 Testing auth service...');
    const { data: authTest, error: authError } = await supabase.auth.getSession();

    console.log('👤 Auth test result:', {
      hasSession: !!authTest.session,
      userId: authTest.session?.user?.id,
      authError: authError?.message
    });

    // 测试一个简单的用户查询
    if (authTest.session?.user?.id) {
      const { data: userTest, error: userError } = await supabase
        .from('profiles')
        .select('id, email, created_at')
        .eq('id', authTest.session.user.id)
        .single();

      console.log('👤 User profile test result:', { userTest, userError });
    }

    // 测试token交换（如果有测试code）
    const testCode = requestUrl.searchParams.get('test_code');
    let tokenTestResult = null;

    if (testCode) {
      console.log('🔄 Testing token exchange with code:', testCode);
      const { data: tokenData, error: tokenError } = await supabase.auth.exchangeCodeForSession(testCode);

      tokenTestResult = {
        success: !tokenError,
        error: tokenError?.message,
        sessionCreated: !!tokenData?.session
      };

      console.log('🔄 Token exchange test result:', tokenTestResult);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      envVars,
      cleanUrls: {
        supabaseUrl: cleanSupabaseUrl,
        supabaseKey: cleanSupabaseKey ? '***SECRET***' : null,
        siteUrl: cleanSiteUrl
      },
      tests: {
        connection: {
          success: !connectionError,
          error: connectionError?.message
        },
        auth: {
          hasSession: !!authTest.session,
          userId: authTest.session?.user?.id,
          email: authTest.session?.user?.email,
          error: authError?.message
        },
        user: authTest.session?.user?.id ? {
          success: !userError,
          error: userError?.message
        } : { skipped: true },
        tokenExchange: tokenTestResult
      }
    });

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}