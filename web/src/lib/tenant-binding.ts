import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';

type TenantBindingTarget =
  | Pick<User, 'id' | 'email' | 'user_metadata'>
  | { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };

const normalizeTenantId = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export async function bindUserToTenant(target: TenantBindingTarget, tenantId: string) {
  const normalized = normalizeTenantId(tenantId);
  if (!normalized) {
    throw new Error('tenant_id 无效');
  }

  const existingMembership = await fetchMembership(target.id, normalized);
  if (existingMembership) {
    return normalized;
  }

  const tenant = await fetchTenantById(normalized);
  if (!tenant) {
    throw new Error('指定的 tenant 不存在');
  }

  const { error: linkError } = await supabaseAdmin.from('tenant_users').insert({
    tenant_id: normalized,
    user_id: target.id,
    role: 'admin',
  });
  if (linkError) {
    console.error('Failed to link tenant to user', linkError);
    throw linkError;
  }

  await syncUserMetadata(target, normalized);
  return normalized;
}

export async function resolveTenantIdForUser(target: TenantBindingTarget, preferredTenantId?: string | null) {
  const preferred = normalizeTenantId(preferredTenantId);
  if (preferred) {
    const hasPreferred = await fetchMembership(target.id, preferred);
    if (hasPreferred) {
      await syncUserMetadata(target, preferred);
      return preferred;
    }
  }

  const existing = await fetchPrimaryTenantId(target.id);
  if (existing) {
    await syncUserMetadata(target, existing);
    return existing;
  }

  if (preferred) {
    try {
      return await bindUserToTenant(target, preferred);
    } catch (error) {
      console.warn('Preferred tenant binding failed', error);
    }
  }

  return createTenantForUser(target);
}

export async function fetchPrimaryTenantId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Failed to load tenant membership', error);
    return null;
  }

  return data?.[0]?.tenant_id ?? null;
}

async function fetchMembership(userId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to check tenant membership', error);
  }

  return data?.tenant_id ?? null;
}

async function fetchTenantById(id: string) {
  const { data, error } = await supabaseAdmin.from('tenants').select('id').eq('id', id).single();
  if (error || !data) {
    if (error) {
      console.error('Failed to fetch tenant by id', error);
    }
    return null;
  }
  return data;
}

async function createTenantForUser(target: TenantBindingTarget) {
  const tenantName = target.email ?? 'New Tenant';
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({ name: tenantName })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    console.error('Failed to create tenant for user', tenantError);
    throw tenantError ?? new Error('create tenant failed');
  }

  const { error: linkError } = await supabaseAdmin
    .from('tenant_users')
    .insert({ tenant_id: tenant.id, user_id: target.id, role: 'admin' });
  if (linkError) {
    console.error('Failed to link tenant to user', linkError);
    throw linkError;
  }

  await syncUserMetadata(target, tenant.id);
  return tenant.id;
}

async function syncUserMetadata(target: TenantBindingTarget, tenantId: string) {
  const currentMetadata = await resolveCurrentMetadata(target);
  if (currentMetadata && currentMetadata.tenant_id === tenantId) {
    return;
  }

  const nextMetadata = { ...(currentMetadata ?? {}), tenant_id: tenantId };
  try {
    await supabaseAdmin.auth.admin.updateUserById(target.id, {
      user_metadata: nextMetadata,
    });
  } catch (error) {
    console.warn('Failed to sync tenant metadata to user', error);
  }
}

async function resolveCurrentMetadata(target: TenantBindingTarget) {
  if (target && typeof target === 'object' && 'user_metadata' in target) {
    const metadata = (target as { user_metadata?: Record<string, unknown> | null }).user_metadata;
    if (metadata && typeof metadata === 'object') {
      return metadata as Record<string, unknown> & { tenant_id?: string };
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(target.id);
  if (error || !data?.user) {
    if (error) {
      console.warn('Failed to fetch user metadata for tenant sync', error);
    }
    return null;
  }
  return (data.user.user_metadata as Record<string, unknown>) ?? null;
}
