import Link from 'next/link';

const stats = [
  { label: '累计处理合同', value: '1,248', sub: '近 30 天' },
  { label: '高风险提醒', value: '86', sub: '本周新增' },
  { label: '自动化任务', value: '12', sub: '实时运行中' },
];

const pillars = [
  {
    title: '法律自动化',
    desc: '以法律顾问流程为蓝本，自动化识别条款、对照法规、生成协作注释，减少反复人工复核。',
  },
  {
    title: 'Agent 协同',
    desc: 'DeepSeek OCR、Docling 拆条 + LLM 风险分析 + pgvector 召回，形成可追踪的多智能体流水线。',
  },
  {
    title: 'SaaS 管理',
    desc: '多租户隔离、实时通知、版本比对、审计日志，帮助风控团队与业务团队统一协同。',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-12 shadow-2xl">
        <div className="max-w-3xl space-y-6 text-white">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">STILL / LEGAL AI</p>
          <h1 className="text-4xl font-semibold leading-tight">
            让合同审查进入 AI 协作时代
            <span className="text-cyan-300"> · 快速锁定风险与机会</span>
          </h1>
          <p className="text-slate-200">
            从上传合同、自动拆条、法规引用、风险分析、条款改写到洞察汇报的一站式流程，由 Supabase Edge Functions 和多智能体协同完成。
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/upload" className="rounded-2xl bg-cyan-400 px-5 py-2 text-slate-900 shadow-lg shadow-cyan-400/40">
              上传合同
            </Link>
            <Link href="/contracts" className="rounded-2xl border border-white/40 px-5 py-2 text-white hover:border-cyan-300">
              查看合同列表
            </Link>
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="surface-panel p-4 text-white">
              <p className="text-sm text-slate-200">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
              <p className="text-xs text-slate-300">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {pillars.map((pillar) => (
          <div key={pillar.title} className="surface-card p-6 text-slate-100">
            <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
            <p className="mt-3 text-sm text-slate-300">{pillar.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
