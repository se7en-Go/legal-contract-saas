import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 检查环境变量
    const hasUrl = !!supabaseUrl;
    const hasKey = !!supabaseAnonKey;

    // 检查是否有隐藏字符
    const hasNewlineInUrl = supabaseUrl?.includes('\n') || supabaseUrl?.includes('\r');
    const hasNewlineInKey = supabaseAnonKey?.includes('\n') || supabaseAnonKey?.includes('\r');

    // 测试 Supabase 连接
    let supabaseConnectionStatus = 'unknown';
    let supabaseError = null;

    if (hasUrl && hasKey && !hasNewlineInUrl && !hasNewlineInKey) {
      try {
        const testResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            'apikey': supabaseAnonKey!,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        });

        supabaseConnectionStatus = testResponse.ok ? 'ok' : 'error';

        if (!testResponse.ok) {
          supabaseError = await testResponse.text();
        }
      } catch (error) {
        supabaseConnectionStatus = 'failed';
        supabaseError = (error as Error).message;
      }
    }

    return NextResponse.json({
      success: true,
      environment: {
        supabaseUrl: {
          present: hasUrl,
          value: hasUrl ? (supabaseUrl || '').substring(0, 50) + '...' : null,
          hasNewline: hasNewlineInUrl,
          length: supabaseUrl?.length || 0,
        },
        supabaseAnonKey: {
          present: hasKey,
          hasNewline: hasNewlineInKey,
          length: supabaseAnonKey?.length || 0,
          startsWith: supabaseAnonKey?.substring(0, 20) + '...',
        },
      },
      connection: {
        status: supabaseConnectionStatus,
        error: supabaseError,
      },
      diagnosis: {
        overall: hasUrl && hasKey && !hasNewlineInUrl && !hasNewlineInKey && supabaseConnectionStatus === 'ok',
        issues: [
          !hasUrl ? 'NEXT_PUBLIC_SUPABASE_URL is missing' : null,
          !hasKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing' : null,
          hasNewlineInUrl ? 'NEXT_PUBLIC_SUPABASE_URL contains newline characters' : null,
          hasNewlineInKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY contains newline characters' : null,
          supabaseConnectionStatus !== 'ok' ? 'Supabase connection test failed: ' + supabaseError : null,
        ].filter(Boolean),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
    }, { status: 500 });
  }
}
