import Link from 'next/link';

const stats = [
  { label: '已解析合同', value: '1,248', sub: '过去30天' },
  { label: '高风险警示', value: '86', sub: '待处理' },
  { label: '法规更新', value: '12', sub: '本周新增' },
];

const pillars = [
  {
    title: '法律级治理',
    desc: '以条例库、审计日志和操作痕迹保障合规，满足律所与企业法务要求。',
  },
  {
    title: 'AI 深度审阅',
    desc: 'DeepSeek OCR + 风险识别代理，结合规则引擎给出条款级评估。',
  },
  {
    title: 'SaaS 协同',
    desc: '多租户、任务流、通知与审批串联，让团队协作透明可追溯。',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-12 shadow-2xl">
        <div className="max-w-3xl space-y-6 text-white">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">LEXIGUARD / LEGAL AI</p>
          <h1 className="text-4xl font-semibold leading-tight">
            让合同审查进入 AI 时代，
            <span className="text-cyan-300"> 即刻洞察风险</span>
          </h1>
          <p className="text-slate-200">
            上传合同、自动解析条款、定位风险并给出法规依据——整个工作流由 Supabase Edge Functions 与多 Agent 驱动。
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
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
              <p className="text-sm text-slate-200">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
              <p className="text-xs text-slate-300">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {pillars.map((pillar) => (
          <div key={pillar.title} className="rounded-2xl border border-white/10 bg-white/90 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{pillar.title}</h3>
            <p className="mt-3 text-sm text-slate-600">{pillar.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
