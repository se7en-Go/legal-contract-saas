'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type KeyClause = {
  id: string;
  category: string;
  summary: string | null;
  attributes: Record<string, unknown> | null;
  created_at: string;
  clause: {
    id: string;
    clause_no: string | null;
    title: string | null;
  } | null;
  contract_version: {
    version_no: number;
    contract: {
      title: string;
      counterparty: string | null;
    };
  } | null;
};

export default function ClausesPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [clauses, setClauses] = useState<KeyClause[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    if (!session?.tenant_id) return;
    const controller = new AbortController();
    const fetchClauses = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/key-clauses', window.location.origin);
        if (category !== 'all') url.searchParams.set('category', category);
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '获取关键条款失败');
        setClauses(data.clauses ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchClauses();
    return () => controller.abort();
  }, [session?.tenant_id, category]);

  const categories = useMemo(() => {
    const base = new Set(clauses.map((clause) => clause.category));
    return ['all', ...Array.from(base)];
  }, [clauses]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Key Clause Library</p>
            <h1 className="text-2xl font-semibold text-slate-900">关键条款库</h1>
            <p className="text-sm text-slate-500">LLM 从合同中抽取标准化条款，并附带业务属性，便于沉淀模板与复用。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-full border px-4 py-1 text-sm ${
                  category === item ? 'border-cyan-500 text-cyan-700 bg-cyan-100' : 'border-slate-200 text-slate-600'
                }`}
              >
                {item === 'all' ? '全部' : item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {sessionLoading ? '获取用户信息…' : session ? `当前用户：${session.email}` : sessionError || '未登录'}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {clauses.map((clause) => (
          <article key={clause.id} className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{clause.category}</p>
              <span className="text-xs text-slate-500">{new Date(clause.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{clause.clause?.title ?? '未命名条款'}</h3>
            <p className="mt-2 text-sm text-slate-600">{clause.summary ?? '暂无摘要'}</p>
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold">
                合同：{clause.contract_version?.contract.title ?? '未知合同'} · 版本 {clause.contract_version?.version_no ?? '-'}
              </p>
              <p className="text-xs text-slate-500">对手方：{clause.contract_version?.contract.counterparty ?? '未填写'}</p>
              <p className="text-xs text-slate-500">条款编号：{clause.clause?.clause_no ?? 'N/A'}</p>
            </div>
            {clause.attributes && Object.keys(clause.attributes).length > 0 && (
              <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                {Object.entries(clause.attributes).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <p className="uppercase tracking-[0.2em] text-slate-400">{key}</p>
                    <p className="text-slate-700">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
        {!clauses.length && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-slate-500">
            {loading ? '正在加载关键条款…' : '暂无数据，请等待 Key Clause Extraction Agent 完成任务。'}
          </div>
        )}
      </div>
    </div>
  );
}
