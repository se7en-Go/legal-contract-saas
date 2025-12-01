import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type ServerSupabaseOptions = {
  canWriteCookies?: boolean;
};

export const createServerSupabase = async ({ canWriteCookies = false }: ServerSupabaseOptions = {}) => {
  const cookieStore = await cookies();

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
            cookieStore.set({
              name,
              value,
              ...normalizeCookieOptions(options),
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
