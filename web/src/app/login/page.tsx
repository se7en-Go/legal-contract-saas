import Link from 'next/link';
import { signIn } from './actions';

export default function LoginPage({ searchParams }: { searchParams?: { status?: string } }) {
  const status = searchParams?.status;
  return (
    <div className='mx-auto max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/80 p-8 shadow-xl'>
      <div className='space-y-2 text-center'>
        <p className='text-xs uppercase tracking-[0.4em] text-slate-400'>Access</p>
        <h1 className='text-2xl font-semibold text-slate-900'>登录 LexiGuard</h1>
        <p className='text-sm text-slate-500'>使用你的工作邮箱获取一次性登录链接。</p>
      </div>
      <form action={signIn} className='space-y-4'>
        <div>
          <label className='text-xs uppercase tracking-wide text-slate-500'>邮箱</label>
          <input name='email' type='email' required className='mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none' placeholder='you@firm.com' />
        </div>
        <button type='submit' className='w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-white shadow-lg shadow-emerald-500/40'>发送登录链接</button>
      </form>
      {status === 'sent' && <p className='text-sm text-emerald-600'>邮件已发送，请前往邮箱完成登录。</p>}
      <p className='text-xs text-slate-500'>还没有账号？请联系管理员分配访问权限。</p>
      <Link href='/' className='text-xs text-cyan-600 hover:underline'> ← 返回首页</Link>
    </div>
  );
}
