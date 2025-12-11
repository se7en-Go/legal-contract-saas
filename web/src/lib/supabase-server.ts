import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import {
  PROXY_SUPABASE_CONFIG,
  detectCloudflareProxy,
  createProxyOptimizedCookieOptions
} from './supabase-proxy-config';

type ServerSupabaseOptions = {
  canWriteCookies?: boolean;
  request?: Request; // 添加request参数以检测代理
};

export const createServerSupabase = async ({
  canWriteCookies = false,
  request
}: ServerSupabaseOptions = {}) => {
  const cookieStore = await cookies();

  // 获取当前域名用于 Cookie 设置
  const getDomain = () => {
    if (typeof window !== 'undefined') {
      return window.location.hostname;
    }
    // 服务端从环境变量获取
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    try {
      // 清理URL中的换行符和空白字符
      const cleanUrl = siteUrl.trim().replace(/[\n\r]/g, '');
      return new URL(cleanUrl).hostname;
    } catch {
      return 'localhost';
    }
  };

  const isProduction = process.env.NODE_ENV === 'production';
  const domain = getDomain();
  const isViaCloudflare = detectCloudflareProxy(request);

  // 清理环境变量中的换行符和空白字符
  const cleanSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/[\n\r]/g, '');
  const cleanSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/[\n\r]/g, '');

  if (!cleanSupabaseUrl || !cleanSupabaseKey) {
    throw new Error('Missing required Supabase environment variables');
  }

  console.log('🌐 Supabase Configuration:', {
    isProduction,
    domain,
    isViaCloudflare,
    siteUrl: PROXY_SUPABASE_CONFIG.getSiteUrl(),
  });

  return createServerClient(
    cleanSupabaseUrl,
    cleanSupabaseKey,
    {
      cookies: {
        getAll: async () => cookieStore.getAll(),
        setAll: async (cookiesToSet) => {
          if (!canWriteCookies) {
            return;
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = normalizeCookieOptions(options);

            // 使用代理优化配置
            if (isProduction && domain !== 'localhost') {
              const proxyOptimizedOptions = createProxyOptimizedCookieOptions(
                isProduction,
                domain,
                isViaCloudflare
              );

              Object.assign(cookieOptions, proxyOptimizedOptions);

              console.log('🍪 Cookie Options Set:', {
                name,
                domain: cookieOptions.domain,
                sameSite: cookieOptions.sameSite,
                secure: cookieOptions.secure,
                isViaCloudflare,
              });
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
