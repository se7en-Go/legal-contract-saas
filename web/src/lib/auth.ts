import type { User } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';
import { bindUserToTenant, resolveTenantIdForUser } from './tenant-binding';

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
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new UnauthorizedError();
  }

  const expected = typeof expectedTenantId === 'string' ? expectedTenantId.trim() : null;
  const metadataTenant =
    typeof data.user.user_metadata?.tenant_id === 'string'
      ? data.user.user_metadata.tenant_id.trim()
      : null;

  let tenantId: string | null;
  if (expected) {
    try {
      tenantId = await bindUserToTenant(data.user, expected);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'tenant_id 无效';
      throw new ForbiddenError(message);
    }
  } else {
    tenantId = await resolveTenantIdForUser(data.user, metadataTenant);
  }

  if (!tenantId) {
    throw new ForbiddenError('用户未绑定 tenant_id');
  }

  if (expected && tenantId !== expected) {
    throw new ForbiddenError('tenant_id 与当前会话不匹配');
  }

  return { user: data.user, tenantId };
}
