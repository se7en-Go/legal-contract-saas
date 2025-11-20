import { createBrowserClient } from '@supabase/ssr';

export const createBrowserSupabase = () =>
  createBrowserClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
