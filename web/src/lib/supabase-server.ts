import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

type CookieOptions = {
  path?: string;
  domain?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
  expires?: Date;
  maxAge?: number;
};

export const createServerSupabase = () => {
  const cookieStore = cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: false,
        persistSession: false,
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: CookieOptions) {
          cookieStore.set({
            name,
            value,
            ...(options ?? {}),
          });
        },
      },
    }
  );
};
