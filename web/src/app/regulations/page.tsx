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
  const [info, setInfo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [jurisdiction, setJurisdiction] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [tagFilter, setTagFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);

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
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchRegulations();
    return () => controller.abort();
  }, [session?.tenant_id, search, jurisdiction, refreshKey]);

  const jurisdictions = useMemo(() => {
    const set = new Set(regulations.map((regulation) => regulation.jurisdiction).filter(Boolean));
    return ['all', ...Array.from(set) as string[]];
  }, [regulations]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    regulations.forEach((reg) => {
      reg.regulation_sections.forEach((section) => {
        (section.tags ?? []).forEach((tag) => set.add(tag));
      });
    });
    return ['all', ...Array.from(set)];
  }, [regulations]);

  const filteredRegulations = useMemo(() => {
    if (tagFilter === 'all') return regulations;
    return regulations.filter((reg) =>
      reg.regulation_sections.some((section) => (section.tags ?? []).includes(tagFilter))
    );
  }, [regulations, tagFilter]);

  const handleSync = async () => {
    setSyncing(true);
    setInfo(null);
    if (!session?.tenant_id) {
      setError('当前账号未绑定租户，无法同步法规');
      setSyncing(false);
      return;
    }
    try {
      const res = await fetch('/api/regulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: session.tenant_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '触发同步失败');
      setInfo('已触发同步任务，稍后刷新。');
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Regulation Retrieval</p>
            <h1 className="text-2xl font-semibold text-white">法规引用</h1>
            <p className="text-sm text-slate-400">监管归档由 Regulation Retrieval Agent 周期拉取，可按地区与关键词筛选引用条款。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded-2xl border border-cyan-400/70 px-4 py-2 text-xs text-cyan-200 disabled:opacity-40"
            >
              {syncing ? '同步中…' : '立即同步'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {jurisdictions.map((item) => (
              <button
                key={item}
                onClick={() => setJurisdiction(item)}
                className={`surface-chip px-4 py-1 text-xs uppercase ${
                  jurisdiction === item ? 'border-cyan-300/80 text-cyan-100' : 'text-slate-300'
                }`}
              >
                {item === 'all' ? '全部' : item}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className={`surface-chip px-3 py-0.5 ${tagFilter === tag ? 'border-emerald-300/70 text-emerald-100' : 'text-slate-400'}`}
              >
                {tag === 'all' ? '全部标签' : tag}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 ESG / 金融监管 / 行业指引…"
            className="flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <div className="surface-panel px-4 py-2 text-xs text-slate-300">
            当前用户：{session?.email ?? (sessionLoading ? '获取中…' : '未登录')}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-amber-300">{error}</p>}
        {info && <p className="mt-1 text-sm text-emerald-300">{info}</p>}
        {sessionError && <p className="mt-2 text-sm text-red-400">{sessionError}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {filteredRegulations.map((reg) => (
          <article key={reg.id} className="surface-card p-6">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>{reg.jurisdiction ?? '通用'}</span>
              <span>
                {reg.effective_date ?? '生效待定'} ~ {reg.expiry_date ?? '长期有效'}
              </span>
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white">{reg.name}</h3>
            {reg.source_url && (
              <a className="text-xs text-cyan-300 hover:underline" href={reg.source_url} target="_blank" rel="noreferrer">
                查看原文
              </a>
            )}
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {reg.regulation_sections.map((section) => (
                <div key={section.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{section.section_no ?? '章节'}</p>
                  <p className="mt-1 text-slate-200">
                    {section.text.slice(0, 280)}
                    {section.text.length > 280 ? '…' : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    {(section.tags ?? []).map((tag) => (
                      <span key={tag} className="surface-chip px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!reg.regulation_sections.length && <p className="text-xs text-slate-400">尚未同步章节，可等待 OCR / 嵌入任务完成。</p>}
            </div>
          </article>
        ))}
        {!filteredRegulations.length && (
          <div className="surface-card p-8 text-center text-slate-400">
            {loading ? '正在加载法规…' : '暂无法规记录，请稍后再试。'}
          </div>
        )}
      </div>
    </div>
  );
}
