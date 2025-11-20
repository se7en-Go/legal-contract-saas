import type { User } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';

export class UnauthorizedError extends Error {
  constructor(message = '用户未登录') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = '无权访问该资源') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export type TenantSession = {
  user: User;
  tenantId: string;
};

export async function requireTenantSession(expectedTenantId?: string | null): Promise<TenantSession> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new UnauthorizedError();
  }

  const tenantId = String(data.user.user_metadata?.tenant_id ?? '').trim();
  if (!tenantId) {
    throw new ForbiddenError('用户未绑定 tenant_id');
  }

  if (expectedTenantId && tenantId !== expectedTenantId) {
    throw new ForbiddenError('tenant_id 与当前会话不匹配');
  }

  return { user: data.user, tenantId };
}
