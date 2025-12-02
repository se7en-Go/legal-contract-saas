import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type ServerSupabaseOptions = {
  canWriteCookies?: boolean;
};

export const createServerSupabase = async ({ canWriteCookies = false }: ServerSupabaseOptions = {}) => {
  const cookieStore = await cookies();

  // 获取当前域名用于 Cookie 设置
  const getDomain = () => {
    if (typeof window !== 'undefined') {
      return window.location.hostname;
    }
    // 服务端从环境变量获取
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return 'localhost';
    }
  };

  const isProduction = process.env.NODE_ENV === 'production';
  const domain = getDomain();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => cookieStore.getAll(),
        setAll: async (cookiesToSet) => {
          if (!canWriteCookies) {
            return;
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = normalizeCookieOptions(options);

            // 生产环境 Cookie 配置
            if (isProduction && domain !== 'localhost') {
              cookieOptions.domain = domain.includes('.') ? domain : `.${domain}`;
              cookieOptions.secure = true;
              // 修复：使用 'lax' 而不是 'none' 来解决跨域问题
              cookieOptions.sameSite = 'lax';
            }

            cookieStore.set({
              name,
              value,
              ...cookieOptions,
            });
          });
        },
      },
    }
  );
};

function normalizeCookieOptions(options?: CookieOptions): CookieOptions {
  if (!options) {
    return {};
  }
  const normalized: CookieOptions = { ...options };
  if (options.expires && typeof options.expires === 'string') {
    normalized.expires = new Date(options.expires);
  }
  return normalized;
}
