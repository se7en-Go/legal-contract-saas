'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTenantSession } from '@/hooks/use-tenant-session';

type RiskFinding = {
  id: string;
  clause_id: string;
  contract_id: string;
  contract_title: string;
  contract_counterparty: string | null;
  contract_version_id: string;
  contract_version_no: number | null;
  clause_title: string | null;
  risk_level: string;
  description: string | null;
  recommendation: string | null;
  resolution_status: string;
  created_at: string;

  // ✅ 新增：立场感知增强字段
  analysis_position?: 'party_a' | 'party_b' | 'neutral';
  position_based_insight?: {
    advantage_type: 'favorable' | 'unfavorable' | 'neutral';
    business_impact: string;
    negotiation_points: string[];
  };
  commercial_guidance?: string;
  analysis_metadata?: {
    analysis_stage: string;
    model_used: string;
    confidence_score: number;
    timestamp: string;
  };
};

type RiskStats = {
  total: number;
  high: number;
  medium: number;
  low: number;
};

type RiskLevelFilter = 'all' | 'high' | 'medium' | 'low';

const LEVEL_FILTER_VALUES: RiskLevelFilter[] = ['all', 'high', 'medium', 'low'];

const LEVEL_FILTER_LABELS: Record<RiskLevelFilter, string> = {
  all: '全部',
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};

const LEVEL_LABELS: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};

const LEVEL_CHIP_STYLES: Record<string, string> = {
  high: 'surface-chip border-rose-300/60 text-rose-200',
  medium: 'surface-chip border-amber-300/60 text-amber-200',
  low: 'surface-chip border-emerald-300/60 text-emerald-200',
};

const STATUS_LABELS: Record<string, string> = {
  open: '待处置',
  resolved: '已处置',
};

export default function RisksPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const searchParams = useSearchParams();
  const [risks, setRisks] = useState<RiskFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<RiskLevelFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState(searchParams.get('contractId') ?? '');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rerunId, setRerunId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<'party_a' | 'party_b' | 'neutral'>('neutral');
  const [stats, setStats] = useState<RiskStats>({ total: 0, high: 0, medium: 0, low: 0 });
  const levelCounts: Record<RiskLevelFilter, number> = {
    all: stats.total,
    high: stats.high,
    medium: stats.medium,
    low: stats.low,
  };

  const fetchRisks = useCallback(async () => {
    if (!session?.tenant_id) {
      setError('尚未登录或缺少 tenant_id');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/risk-findings', window.location.origin);
      if (level !== 'all') url.searchParams.set('level', level);
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);
      if (contractFilter) url.searchParams.set('contractId', contractFilter);
      if (searchTerm) url.searchParams.set('search', searchTerm);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '获取风险列表失败');
      setRisks(data.risks ?? []);
      setTotal(data.total ?? 0);
      const apiStats = data.stats ?? {};
      setStats({
        total: apiStats.total ?? data.total ?? data.risks?.length ?? 0,
        high: apiStats.high ?? 0,
        medium: apiStats.medium ?? 0,
        low: apiStats.low ?? 0,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [session?.tenant_id, level, statusFilter, contractFilter, searchTerm, page]);

  useEffect(() => {
    void fetchRisks();
  }, [fetchRisks]);

  useEffect(() => {
    setPage(1);
  }, [level, statusFilter, searchTerm, contractFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = risks.length > 0 && risks.every((risk) => selectedIds.includes(risk.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !risks.some((risk) => risk.id === id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...risks.map((risk) => risk.id)])));
    }
  };

  const handleBulkUpdate = async (status: 'resolved' | 'open') => {
    if (!selectedIds.length) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/risk-findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '批量更新失败');
      setSelectedIds([]);
      await fetchRisks();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const header = '合同,条款,风险等级,状态,建议\n';
      const rows = risks
        .map((risk) =>
          [
            risk.contract_title,
            risk.clause_title ?? '未命名条款',
            LEVEL_LABELS[risk.risk_level] ?? risk.risk_level,
            STATUS_LABELS[risk.resolution_status] ?? risk.resolution_status,
            (risk.recommendation ?? '').replace(/\r?\n/g, ' '),
          ].join(',')
        )
        .join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `risk-findings-page-${page}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleManualRerun = async (risk: RiskFinding, position?: 'party_a' | 'party_b' | 'neutral') => {
    setRerunId(risk.id);
    try {
      const res = await fetch('/api/risk-findings/rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractVersionId: risk.contract_version_id,
          user_position: position || userPosition
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '触发重跑失败');
      await fetchRisks();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRerunId(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.35em] text-slate-400">风险识别引擎</p>
            <h1 className="text-2xl font-semibold text-white">风险监控面板</h1>
            <p className="text-sm text-slate-400">聚合 LLM 风险识别结果，支持按等级筛选并查看整改建议。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {LEVEL_FILTER_VALUES.map((item) => (
              <button
                key={item}
                onClick={() => setLevel(item)}
                className={`surface-chip px-4 py-1 text-xs ${
                  level === item ? 'border-rose-200/70 text-rose-100' : 'text-slate-300'
                }`}
              >
                {`${LEVEL_FILTER_LABELS[item]}（${levelCounts[item]}）`}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="搜索摘要 / 建议关键词"
              className="min-w-[180px] flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <input
              value={contractFilter}
              onChange={(event) => setContractFilter(event.target.value)}
              placeholder="按合同 ID 过滤"
              className="w-48 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm"
            >
              <option value="all">全部状态</option>
              <option value="open">待处置</option>
              <option value="resolved">已处置</option>
            </select>
            <button
              onClick={() => handleBulkUpdate('resolved')}
              disabled={!selectedIds.length || bulkLoading}
              className="rounded-2xl border border-emerald-400/60 px-3 py-2 text-xs text-emerald-200 disabled:opacity-40"
            >
              标记已处置
            </button>
            <button
              onClick={() => handleBulkUpdate('open')}
              disabled={!selectedIds.length || bulkLoading}
              className="rounded-2xl border border-amber-400/60 px-3 py-2 text-xs text-amber-200 disabled:opacity-40"
            >
              重新打开
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-2xl border border-cyan-400/60 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"
            >
              导出表格
            </button>
            <select
              value={userPosition}
              onChange={(e) => setUserPosition(e.target.value as 'party_a' | 'party_b' | 'neutral')}
              className="rounded-2xl border border-purple-400/60 bg-slate-900/60 px-3 py-2 text-xs text-purple-200 focus:border-purple-300 focus:outline-none"
            >
              <option value="neutral">⚪ 中立分析</option>
              <option value="party_a">🟢 甲方立场</option>
              <option value="party_b">🔵 乙方立场</option>
            </select>
            <span className="text-xs text-slate-400">已选 {selectedIds.length} 条</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          {sessionLoading ? '获取用户信息…' : session ? `当前用户：${session.email}` : sessionError || '未登录'}
        </div>
        {error && <p className="mt-2 text-sm text-amber-300">{error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="surface-panel p-4 text-center">
          <p className="text-sm text-slate-400 text-center">风险总览（不分页）</p>
          <p className="mt-2 text-3xl font-semibold text-white text-center">{stats.total}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-sm text-slate-400 text-center">高风险</p>
          <p className="mt-2 text-3xl font-semibold text-rose-200 text-center">{stats.high}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-sm text-slate-400 text-center">中风险</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200 text-center">{stats.medium}</p>
        </div>
        <div className="surface-panel p-4 text-center">
          <p className="text-sm text-slate-400 text-center">低风险</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200 text-center">{stats.low}</p>
        </div>
      </div>

      <div className="surface-card p-0">
        <table className="surface-table min-w-full divide-y divide-white/5 text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900"
                />
              </th>
              <th className="px-4 py-3 text-center">合同 / 条款</th>
              <th className="px-4 py-3 text-center">风险等级</th>
              <th className="px-4 py-3 text-center">摘要</th>
              <th className="px-4 py-3">建议</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {risks.map((risk) => {
              const isSelected = selectedIds.includes(risk.id);
              return (
                <tr key={risk.id} className={risk.resolution_status === 'resolved' ? 'bg-emerald-500/5' : undefined}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(risk.id)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{risk.contract_title}</p>
                    <p className="text-xs text-slate-400">{risk.clause_title ?? '未命名条款'}</p>
                    <p className="text-xs text-slate-500">
                      版本 {risk.contract_version_no ?? '-'} · 对手方：{risk.contract_counterparty ?? '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col items-center space-y-1">
                      <span className={`${LEVEL_CHIP_STYLES[risk.risk_level] ?? 'surface-chip'} px-3 py-1 text-xs text-center min-w-[60px]`}>
                        {LEVEL_LABELS[risk.risk_level] ?? risk.risk_level}
                      </span>
                      <span className="text-xs text-slate-400 text-center">
                        {STATUS_LABELS[risk.resolution_status] ?? '待处置'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div>{risk.description ?? '暂无描述'}</div>

                    {/* ✅ 立场分析显示 */}
                    {risk.position_based_insight?.advantage_type && (
                      <div className="mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          risk.position_based_insight.advantage_type === 'favorable'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : risk.position_based_insight.advantage_type === 'unfavorable'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}>
                          {risk.position_based_insight.advantage_type === 'favorable' ? '✓ 有利' :
                           risk.position_based_insight.advantage_type === 'unfavorable' ? '✗ 不利' : '○ 中立'}
                        </span>
                      </div>
                    )}

                    {/* ✅ 商业建议显示 */}
                    {risk.commercial_guidance && (
                      <div className="mt-2 text-xs text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded">
                        💼 {risk.commercial_guidance}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{risk.recommendation ?? '暂无建议'}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(risk.created_at).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td className="px-3 py-3 text-xs w-[100px]">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg border border-blue-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        style={{ writingMode: 'horizontal-tb' }}
                        disabled={rerunId === risk.id}
                        onClick={() => void handleManualRerun(risk)}
                      >
                        {rerunId === risk.id ? '重跑中…' : '重新分析'}
                      </button>
                      {risk.analysis_position && (
                        <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                          risk.analysis_position === 'party_a'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : risk.analysis_position === 'party_b'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}>
                          {risk.analysis_position === 'party_a' ? '甲方' :
                           risk.analysis_position === 'party_b' ? '乙方' : '中立'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!risks.length && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={7}>
                  {loading ? '加载风险中…' : '暂无风险记录。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <p>
          第 {page} / {totalPages} 页 · 当前筛选 {total} 条
        </p>
        <div className="flex gap-2">
          <button
            className="surface-chip px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            上一页
          </button>
          <button
            className="surface-chip px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
