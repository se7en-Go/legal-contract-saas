import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * 针对Cloudflare代理环境优化的Cookie配置
 */
export function createProxyOptimizedCookieOptions(
  isProduction: boolean,
  domain: string,
  isViaCloudflare: boolean = false
): CookieOptions {
  const baseOptions: CookieOptions = {
    path: '/',
    httpOnly: true,
  };

  if (!isProduction || domain === 'localhost') {
    // 开发环境：宽松配置
    return {
      ...baseOptions,
      secure: false,
      sameSite: 'lax',
    };
  }

  // 生产环境：代理优化配置
  if (isViaCloudflare) {
    return {
      ...baseOptions,
      domain: domain.includes('.') ? domain : `.${domain}`,
      secure: true,
      sameSite: 'none', // 代理环境需要none以支持跨域
    };
  }

  // 标准生产环境
  return {
    ...baseOptions,
    domain: domain.includes('.') ? domain : `.${domain}`,
    secure: true,
    sameSite: 'lax',
  };
}

/**
 * 检测请求是否通过Cloudflare代理
 */
export function detectCloudflareProxy(request?: Request): boolean {
  // 检查Cloudflare特征头
  const headers = request?.headers || (typeof window !== 'undefined' ? window.location.hostname.includes('cloudflare') : false);

  if (typeof window !== 'undefined') {
    // 客户端检测
    return window.location.hostname.includes('dpdns.org') ||
           window.location.hostname.includes('workers.dev') ||
           document.cookie.includes('cf_worker');
  }

  if (request) {
    // 服务端检测
    return !!(
      request.headers.get('cf-ray') ||
      request.headers.get('cf-visitor') ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')
    );
  }

  return false;
}

/**
 * 获取真实客户端IP地址
 */
export function getRealClientIP(request?: Request): string {
  if (!request) return 'unknown';

  const headers = request.headers;

  // 按优先级检查各种头部
  const ipHeaders = [
    'cf-connecting-ip', // Cloudflare
    'x-real-ip',        // Nginx
    'x-forwarded-for',  // 标准代理头
    'x-client-ip',      // Apache
  ];

  for (const header of ipHeaders) {
    const ip = headers.get(header);
    if (ip) {
      // x-forwarded-for可能包含多个IP，取第一个
      return ip.split(',')[0].trim();
    }
  }

  return 'unknown';
}

/**
 * 针对代理环境的Supabase配置
 */
export const PROXY_SUPABASE_CONFIG = {
  // 确保协议一致性
  getSiteUrl: () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // 强制HTTPS用于生产环境
    if (process.env.NODE_ENV === 'production') {
      return siteUrl.replace(/^http:\/\//, 'https://');
    }

    return siteUrl;
  },

  // 代理感知的Cookie配置
  getCookieOptions: (request?: Request) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const domain = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').hostname;
    const isViaCloudflare = detectCloudflareProxy(request);

    return createProxyOptimizedCookieOptions(isProduction, domain, isViaCloudflare);
  },
};