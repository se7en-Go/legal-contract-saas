'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export const AuthHashHandler = () => {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);

    // 如果有 code 参数，说明是服务端回调处理，不处理 hash
    if (urlParams.has('code')) {
      console.log('🔄 Auth callback: code parameter found, skipping hash handler');
      return;
    }

    // 如果没有 access_token 或 refresh_token，直接返回
    if (!hash || (!hash.includes('access_token') && !hash.includes('refresh_token'))) {
      return;
    }

    console.log('🔄 Auth hash handler: Processing tokens from hash');

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      console.warn('⚠️ Incomplete auth tokens in hash');
      return;
    }

    const supabase = createBrowserSupabase();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error('❌ Failed to set session from hash:', error);
          return;
        }

        console.log('✅ Session successfully set from hash');
        // 清理 URL 中的 hash 和搜索参数
        const cleanUrl = window.location.pathname;
        router.replace(cleanUrl);
      });
  }, [router]);

  return null;
};
