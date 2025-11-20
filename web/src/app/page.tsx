import Link from 'next/link';

export default function HomePage() {
  return (
    <div className='space-y-8'>
      <section className='rounded-2xl border bg-white p-8 shadow-sm'>
        <p className='text-sm uppercase tracking-wide text-slate-500'>Overview</p>
        <h1 className='mt-2 text-3xl font-semibold text-slate-900'>Legal AI Contract Review</h1>
        <p className='mt-4 text-slate-600'>Upload合同、追踪解析任务并查看AI生成的风险和关键条款。需要设置 Supabase/Scheduler 后即可跑通端到端流程。</p>
        <div className='mt-6 flex flex-wrap gap-4'>
          <Link href='/upload' className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500'>上传合同</Link>
          <Link href='/contracts' className='rounded-lg border px-4 py-2 text-blue-600 hover:border-blue-600'>查看合同列表</Link>
        </div>
      </section>
    </div>
  );
}
