import { useCallback, useEffect, useState } from 'react';

export type TenantSessionInfo = {
  email: string;
  tenant_id: string | null;
  role?: string | null;
};

type SessionResponse = {
  user: {
    email: string;
    tenant_id: string | null;
    role?: string | null;
  } | null;
};

export const useTenantSession = () => {
  const [session, setSession] = useState<TenantSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/session', { cache: 'no-store' });
      const data: SessionResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as unknown as { error?: string })?.error ?? '获取用户信息失败');
      }
      if (!data.user) {
        setSession(null);
        setError('未登录');
        return;
      }
      setSession({
        email: data.user.email,
        tenant_id: data.user.tenant_id,
        role: data.user.role ?? null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  return {
    session,
    loading,
    error,
    refresh: fetchSession,
  };
};
