'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type Regulation = {
  id: string;
  name: string;
  jurisdiction: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  source_url: string | null;
  regulation_sections: { id: string; section_no: string | null; text: string; tags: string[] | null }[];
};

export default function RegulationsPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [jurisdiction, setJurisdiction] = useState('all');

  useEffect(() => {
    if (!session?.tenant_id) return;
    const controller = new AbortController();
    const fetchRegulations = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/regulations', window.location.origin);
        if (search) url.searchParams.set('q', search);
        if (jurisdiction !== 'all') url.searchParams.set('jurisdiction', jurisdiction);
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '获取法规失败');
        setRegulations(data.regulations ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchRegulations();
    return () => controller.abort();
  }, [session?.tenant_id, search, jurisdiction]);

  const jurisdictions = useMemo(() => {
    const set = new Set(regulations.map((regulation) => regulation.jurisdiction).filter(Boolean));
    return ['all', ...Array.from(set) as string[]];
  }, [regulations]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Regulation Retrieval</p>
            <h1 className="text-2xl font-semibold text-slate-900">法规引用</h1>
            <p className="text-sm text-slate-500">监管归档由 Regulation Retrieval Agent 周期拉取，可按地区与关键词筛选引用条款。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {jurisdictions.map((item) => (
              <button
                key={item}
                onClick={() => setJurisdiction(item)}
                className={`rounded-full border px-4 py-1 ${jurisdiction === item ? 'border-cyan-500 text-cyan-700 bg-cyan-100' : 'border-slate-200 text-slate-600'}`}
              >
                {item === 'all' ? '全部' : item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 ESG / 金融监管 / 行业指引…"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            当前用户：{session?.email ?? (sessionLoading ? '获取中…' : '未登录')}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {sessionError && <p className="mt-2 text-sm text-red-600">{sessionError}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {regulations.map((reg) => (
          <article key={reg.id} className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{reg.jurisdiction ?? '通用'}</span>
              <span>
                {reg.effective_date ?? '生效待定'} ~ {reg.expiry_date ?? '长期有效'}
              </span>
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{reg.name}</h3>
            {reg.source_url && (
              <a className="text-xs text-cyan-600 hover:underline" href={reg.source_url} target="_blank" rel="noreferrer">
                查看原文
              </a>
            )}
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {reg.regulation_sections.map((section) => (
                <div key={section.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{section.section_no ?? '章节'}</p>
                  <p>{section.text.slice(0, 280)}{section.text.length > 280 ? '…' : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {(section.tags ?? []).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 px-2 py-0.5">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
              {!reg.regulation_sections.length && <p className="text-xs text-slate-500">尚未同步章节，可等待 OCR / 嵌入任务完成。</p>}
            </div>
          </article>
        ))}
        {!regulations.length && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-slate-500">
            {loading ? '正在加载法规…' : '暂无法规记录，请稍后再试。'}
          </div>
        )}
      </div>
    </div>
  );
}
