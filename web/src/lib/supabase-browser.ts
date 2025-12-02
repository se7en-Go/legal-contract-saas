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

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
