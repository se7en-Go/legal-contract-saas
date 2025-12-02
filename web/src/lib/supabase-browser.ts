import { createBrowserClient } from '@supabase/ssr';

export const createBrowserSupabase = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  // 获取域名用于 Cookie 设置
  const getDomain = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // 生产环境返回域名，开发环境返回 undefined
      return isProduction && hostname !== 'localhost' ? hostname : undefined;
    }
    return undefined;
  };

  const domain = getDomain();

  // 清理环境变量中的换行符和空白字符
  const cleanSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/[\n\r]/g, '');
  const cleanSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/[\n\r]/g, '');

  if (!cleanSupabaseUrl || !cleanSupabaseKey) {
    throw new Error('Missing required Supabase environment variables');
  }

  return createBrowserClient(
    cleanSupabaseUrl,
    cleanSupabaseKey,
    {
      auth: {
        // 确保页面刷新后保持会话
        persistSession: true,
        // 自动刷新 token
        autoRefreshToken: true,
      },
      cookieOptions: {
        // 生产环境 Cookie 配置
        ...(isProduction && domain && {
          domain: domain.includes('.') ? domain : `.${domain}`,
          secure: true,
          sameSite: 'lax',
        }),
      },
    }
  );
};
