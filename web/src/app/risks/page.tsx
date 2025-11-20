'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type RiskFinding = {
  id: string;
  risk_level: string;
  risk_type: string | null;
  description: string | null;
  recommendation: string | null;
  regulation_refs: unknown;
  created_at: string;
  clause: {
    id: string;
    clause_no: string | null;
    title: string | null;
    contract_version: {
      version_no: number;
      contract: {
        title: string;
        counterparty: string | null;
      };
    };
  } | null;
};

const severityColor: Record<string, string> = {
  high: 'bg-red-500/20 text-red-200 border-red-400/40',
  medium: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  low: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
};

const normalizeRegulationRefs = (value: unknown): string[] => {
  const toLabel = (item: unknown) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return JSON.stringify(item);
    return '';
  };
  if (Array.isArray(value)) {
    return value.map(toLabel).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(toLabel).filter(Boolean);
      }
    } catch {
      return [value];
    }
    return [value];
  }
  if (value && typeof value === 'object') {
    return [JSON.stringify(value)];
  }
  return [];
};

export default function RisksPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [risks, setRisks] = useState<RiskFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!session?.tenant_id) return;
    const controller = new AbortController();
    const fetchRisks = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/risk-findings', window.location.origin);
        if (search) url.searchParams.set('search', search);
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '获取风险列表失败');
        setRisks(data.risks ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchRisks();
    return () => controller.abort();
  }, [session?.tenant_id, search]);

  const filteredRisks = useMemo(() => {
    if (levelFilter === 'all') return risks;
    return risks.filter((risk) => risk.risk_level?.toLowerCase() === levelFilter);
  }, [risks, levelFilter]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Risk Analyzer</p>
            <h1 className="text-2xl font-semibold text-slate-900">风险洞察</h1>
            <p className="text-sm text-slate-500">查看 LLM 风险分析结果、监管引用与 AI 建议，支持关键词搜索与风险等级筛选。</p>
          </div>
          <div className="flex gap-3">
            {['all', 'high', 'medium', 'low'].map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`rounded-full border px-4 py-1 text-sm capitalize ${
                  levelFilter === level ? 'border-cyan-500 text-cyan-700 bg-cyan-100' : 'border-slate-200 text-slate-600'
                }`}
              >
                {level === 'all' ? '全部' : level}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入关键词，如 违约责任 / ESG / 法规名称"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            当前用户：{session?.email ?? (sessionLoading ? '获取中…' : '未登录')}
          </div>
        </div>
        {sessionError && <p className="mt-3 text-sm text-red-600">{sessionError}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">风险说明</th>
                <th className="px-4 py-3">等级</th>
                <th className="px-4 py-3">所属合同</th>
                <th className="px-4 py-3">AI 建议</th>
                <th className="px-4 py-3">发现时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRisks.map((risk) => {
                const refs = normalizeRegulationRefs(risk.regulation_refs);
                return (
                  <Fragment key={risk.id}>
                    <tr>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">{risk.risk_type || '未命名风险'}</span>
                        <p className="text-xs text-slate-500">{risk.description ?? '暂无描述'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${severityColor[risk.risk_level?.toLowerCase() ?? 'low'] ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}
                        >
                          {risk.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{risk.clause?.contract_version.contract.title ?? '未知合同'}</p>
                        <p className="text-xs text-slate-400">{risk.clause?.contract_version.contract.counterparty ?? '未填写对手方'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{risk.recommendation ?? '暂无建议'}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(risk.created_at)}</td>
                    </tr>
                    {refs.length > 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 pb-4 text-xs text-slate-500">
                          <div className="flex flex-wrap gap-2">
                            {refs.map((ref) => (
                              <span key={ref} className="rounded-full border border-slate-200 px-2 py-0.5">
                                {ref}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!filteredRisks.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                    {loading ? '加载中…' : '暂无风险分析结果，上传合同并完成解析后可查看。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold">高风险摘要</h3>
            <p className="text-sm text-slate-300">快速了解最需要关注的风险与建议。</p>
            <div className="mt-4 space-y-4 text-sm">
              {risks
                .filter((risk) => risk.risk_level?.toLowerCase() === 'high')
                .slice(0, 4)
                .map((risk) => (
                  <div key={risk.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="font-semibold">{risk.risk_type ?? '风险'}</p>
                    <p className="text-xs text-slate-300">{risk.description ?? '暂无描述'}</p>
                    {risk.recommendation && <p className="text-xs text-emerald-300">建议：{risk.recommendation}</p>}
                  </div>
                ))}
              {!risks.filter((risk) => risk.risk_level?.toLowerCase() === 'high').length && <p className="text-slate-400">暂无高风险记录</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">统计概览</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>High 等级：{risks.filter((r) => r.risk_level?.toLowerCase() === 'high').length} 条</li>
              <li>Medium 等级：{risks.filter((r) => r.risk_level?.toLowerCase() === 'medium').length} 条</li>
              <li>Low 等级：{risks.filter((r) => r.risk_level?.toLowerCase() === 'low').length} 条</li>
              <li>涉及合同：{new Set(risks.map((r) => r.clause?.contract_version.contract.title).filter(Boolean)).size} 份</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
