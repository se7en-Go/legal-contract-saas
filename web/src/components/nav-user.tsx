import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { signOut } from '@/app/login/actions';

export const NavUser = async () => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return (
      <Link href="/login" className="text-sm text-slate-200 hover:text-cyan-300">
        登录
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-4 text-sm text-slate-300">
      <span>{user.email}</span>
      <form action={signOut}>
        <button className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white hover:border-cyan-300">
          退出
        </button>
      </form>
    </div>
  );
};
