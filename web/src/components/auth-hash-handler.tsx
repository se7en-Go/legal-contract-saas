'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export const AuthHashHandler = () => {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || (!hash.includes('access_token') && !hash.includes('refresh_token'))) {
      return;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      return;
    }

    const supabase = createBrowserSupabase();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error('Failed to set session from hash', error);
          return;
        }
        const url = window.location.pathname + window.location.search;
        router.replace(url);
      });
  }, [router]);

  return null;
};
