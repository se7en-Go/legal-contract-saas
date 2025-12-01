import Link from 'next/link';
import { signIn } from './actions';
import { SubmitButton } from './submit-button';

type LoginStatus = { status?: string; error?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<LoginStatus> }) {
  const params = await searchParams;
  const status = params?.status;
  const error = params?.error;
  return (
    <div className="mx-auto max-w-md space-y-6 surface-card p-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Access</p>
        <h1 className="text-2xl font-semibold text-white">登录 Still Legal AI</h1>
        <p className="text-sm text-slate-400">输入工作邮箱即可收到一次性登录链接。</p>
      </div>
      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</p>}
      <form action={signIn} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">邮箱</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            placeholder="you@firm.com"
          />
        </div>
        <SubmitButton />
      </form>
      {status === 'sent' && <p className="text-sm text-emerald-300">邮件已发送，请在 5 分钟内完成登录。</p>}
      <p className="text-xs text-slate-400">若尚未开通账号，请联系管理员获取权限。</p>
      <Link href="/" className="text-xs text-cyan-300 hover:underline">
        ← 返回首页
      </Link>
    </div>
  );
}
