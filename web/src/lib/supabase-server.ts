import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const createServerSupabase = () =>
  createServerClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookies,
  });
