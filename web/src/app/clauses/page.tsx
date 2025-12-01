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

type RawClause = {
  id: string;
  clause_no: string | null;
  title: string | null;
  body: string | null;
  created_at: string;
  contract_version: {
    id: string;
    version_no: number | null;
    contract: {
      title: string;
      counterparty: string | null;
    };
  } | null;
};

export default function ClausesPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [keyClauses, setKeyClauses] = useState<KeyClause[]>([]);
  const [rawClauses, setRawClauses] = useState<RawClause[]>([]);
  const [loading, setLoading] = useState(false);
  const [rawLoading, setRawLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'key' | 'raw'>('key');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [savingClauseId, setSavingClauseId] = useState<string | null>(null);

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
        setKeyClauses(data.clauses ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchClauses();
    return () => controller.abort();
  }, [session?.tenant_id, category]);

  useEffect(() => {
    if (!session?.tenant_id || viewMode !== 'raw') return;
    const controller = new AbortController();
    const fetchRawClauses = async () => {
      setRawLoading(true);
      setError(null);
      try {
        const url = new URL('/api/clauses', window.location.origin);
        if (searchTerm) url.searchParams.set('search', searchTerm);
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '获取条款列表失败');
        setRawClauses(data.clauses ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setRawLoading(false);
      }
    };
    void fetchRawClauses();
    return () => controller.abort();
  }, [session?.tenant_id, viewMode, searchTerm]);

  const categories = useMemo(() => {
    const base = new Set(keyClauses.map((clause) => clause.category));
    return ['all', ...Array.from(base)];
  }, [keyClauses]);

  const startEditing = (clauseId: string, currentTitle: string | null) => {
    setEditingClauseId(clauseId);
    setEditingTitle(currentTitle ?? '');
  };

  const cancelEditing = () => {
    setEditingClauseId(null);
    setEditingTitle('');
  };

  const handleSaveTitle = async (clauseId: string) => {
    if (!editingTitle.trim()) {
      setError('标题不能为空');
      return;
    }
    setSavingClauseId(clauseId);
    setError(null);
    try {
      const res = await fetch(`/api/clauses/${clauseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '更新条款标题失败');
      setKeyClauses((prev: KeyClause[]) =>
        prev.map((item: KeyClause) =>
          item.clause?.id === clauseId ? { ...item, clause: { ...item.clause, title: editingTitle.trim() } } : item
        )
      );
      cancelEditing();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingClauseId(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Clause Library</p>
            <h1 className="text-2xl font-semibold text-white">条款库</h1>
            <p className="text-sm text-slate-400">
              可在“关键条款视图”查看沉淀条款，在“原始条款视图”直接校对/编辑 OCR+LLM 拆条结果。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['key', 'raw'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`surface-chip px-4 py-1 text-xs uppercase ${
                  viewMode === mode ? 'border-cyan-300/80 text-cyan-100' : 'text-slate-300'
                }`}
              >
                {mode === 'key' ? '关键条款视图' : '原始条款视图'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          {sessionLoading ? '获取用户信息…' : session ? `当前用户：${session.email}` : sessionError || '未登录'}
        </div>
        {viewMode === 'key' ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`surface-chip px-3 py-1 text-xs ${category === item ? 'border-cyan-300/80 text-cyan-100' : 'text-slate-400'}`}
              >
                {item === 'all' ? '所有分类' : item}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="搜索条款标题或正文关键字"
              className="w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none sm:w-80"
            />
            <button
              onClick={() => setSearchTerm('')}
              className="rounded-2xl border border-white/20 px-3 py-2 text-xs text-slate-300 hover:border-cyan-300"
            >
              清空
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-amber-300">{error}</p>}
      </div>

      {viewMode === 'key' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {keyClauses.map((clause) => (
          <article key={clause.id} className="surface-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{clause.category}</p>
              <span className="text-xs text-slate-500">
                {new Date(clause.created_at).toLocaleString('zh-CN', { hour12: false })}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-white">
              {editingClauseId === clause.clause?.id ? (
                <input
                  value={editingTitle}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  placeholder="填写条款标题"
                  className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-base text-white focus:border-cyan-400 focus:outline-none"
                />
              ) : (
                clause.clause?.title ?? '未命名条款'
              )}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              {clause.clause?.id ? (
                editingClauseId === clause.clause.id ? (
                  <>
                    <button
                      onClick={() => void handleSaveTitle(clause.clause!.id)}
                      className="rounded-2xl bg-cyan-600 px-3 py-1 text-white disabled:opacity-40"
                      disabled={savingClauseId === clause.clause.id}
                    >
                      {savingClauseId === clause.clause.id ? '保存中…' : '保存标题'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="rounded-2xl border border-white/20 px-3 py-1 text-white"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEditing(clause.clause!.id, clause.clause?.title ?? '')}
                    className="rounded-2xl border border-cyan-400/60 px-3 py-1 text-cyan-200 hover:border-cyan-200"
                  >
                    {clause.clause?.title ? '编辑标题' : '补齐标题'}
                  </button>
                )
              ) : (
                <span className="rounded-2xl border border-white/15 px-3 py-1 text-slate-500">
                  无法定位原始条款
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-300">{clause.summary ?? '暂无摘要'}</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">
                合同：{clause.contract_version?.contract.title ?? '未知合同'} · 版本 {clause.contract_version?.version_no ?? '-'}
              </p>
              <p className="text-xs text-slate-400">对手方：{clause.contract_version?.contract.counterparty ?? '未填写'}</p>
              <p className="text-xs text-slate-400">条款编号：{clause.clause?.clause_no ?? 'N/A'}</p>
            </div>
            {clause.attributes && Object.keys(clause.attributes).length > 0 && (
              <div className="mt-4 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
                {Object.entries(clause.attributes).map(([key, value]) => (
                  <div key={key} className="surface-panel px-3 py-2 text-left">
                    <p className="uppercase tracking-[0.2em] text-slate-400">{key}</p>
                    <p className="text-white">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
          {!keyClauses.length && (
            <div className="surface-card p-8 text-center text-slate-400">
              {loading ? '正在加载关键条款…' : '暂无数据，请等待 Key Clause Extraction Agent 完成任务。'}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {rawClauses.map((item) => (
            <article key={item.id} className="surface-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  版本 {item.contract_version?.version_no ?? '-'} · 合同：{item.contract_version?.contract.title ?? '未知合同'}
                </p>
                <span className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {editingClauseId === item.id ? (
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      placeholder="填写条款标题"
                      className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-base text-white focus:border-cyan-400 focus:outline-none"
                    />
                  ) : (
                    item.title ?? '未命名条款'
                  )}
                </h3>
                {editingClauseId === item.id ? (
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => void handleSaveTitle(item.id)}
                      className="rounded-2xl bg-cyan-600 px-3 py-1 text-white disabled:opacity-40"
                      disabled={savingClauseId === item.id}
                    >
                      {savingClauseId === item.id ? '保存中…' : '保存标题'}
                    </button>
                    <button onClick={cancelEditing} className="rounded-2xl border border-white/20 px-3 py-1 text-white">
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing(item.id, item.title ?? '')}
                    className="rounded-2xl border border-cyan-400/60 px-3 py-1 text-cyan-200 hover:border-cyan-200 text-xs"
                  >
                    {item.title ? '编辑标题' : '补齐标题'}
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                {item.body?.slice(0, 600) ?? '暂无正文'}
                {item.body && item.body.length > 600 ? '…' : ''}
              </p>
            </article>
          ))}
          {!rawClauses.length && (
            <div className="surface-card p-8 text-center text-slate-400">
              {rawLoading ? '正在加载条款…' : '暂无原始条款，请先上传并解析合同。'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
