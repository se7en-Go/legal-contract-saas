'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTenantSession } from '@/hooks/use-tenant-session';

type Contract = {
  id: string;
  title: string;
  status: string;
  counterparty: string | null;
  created_at: string;
  risk_count: number;
  contract_type?: string | null;
};

export default function ContractsPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const tenantId = session?.tenant_id ?? '';
  const searchParams = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [counterpartyFilter, setCounterpartyFilter] = useState('');
  const [contractType, setContractType] = useState('all');
  const [minRisk, setMinRisk] = useState(0);
  const [focusedContract, setFocusedContract] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!tenantId) {
      setError('未获取到 tenant_id，无法拉取合同列表');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (counterpartyFilter) params.set('counterparty', counterpartyFilter);
      if (contractType !== 'all') params.set('contractType', contractType);
      if (minRisk > 0) params.set('minRisk', String(minRisk));
      const res = await fetch(`/api/contracts?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载合同数据失败');
      setContracts(data.contracts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, statusFilter, searchTerm, counterpartyFilter, contractType, minRisk]);

  useEffect(() => {
    if (tenantId) {
      void fetchContracts();
    }
  }, [tenantId, fetchContracts]);

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (focusId) {
      setFocusedContract(focusId);
    }
  }, [searchParams]);

  const totalRisks = contracts.reduce((sum, contract) => sum + contract.risk_count, 0);
  const riskyContracts = contracts.filter((c) => c.risk_count > 0);
  const statusGroups = useMemo(() => {
    return contracts.reduce<Record<string, number>>((acc, contract) => {
      acc[contract.status] = (acc[contract.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [contracts]);

  const counterparties = useMemo(() => {
    const set = new Set(contracts.map((contract) => contract.counterparty).filter(Boolean) as string[]);
    return Array.from(set);
  }, [contracts]);

  const contractTypes = useMemo(() => {
    const set = new Set((contracts.map((contract) => contract.contract_type).filter(Boolean) as string[]));
    return Array.from(set);
  }, [contracts]);

  const summaryCards = [
    { label: '合同总数', value: contracts.length.toString(), hint: '当前租户存量' },
    { label: '涉及风险', value: riskyContracts.length.toString(), hint: `累计风险 ${totalRisks} 条` },
    { label: '状态覆盖', value: Object.keys(statusGroups).length.toString(), hint: '不同阶段的合同' },
  ];

  const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

  return (
    <div className="space-y-6 text-slate-100">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">合同总览</h2>
            <p className="text-sm text-slate-300">系统根据 tenant_id 自动加载合同，确认租户正确后即可查看最新审核结果。</p>
          </div>
          <button
            onClick={fetchContracts}
            className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-500/40 disabled:opacity-50"
            disabled={loading || !tenantId}
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="surface-panel px-4 py-3 text-sm">
            <p className="text-slate-400">当前用户</p>
            <p className="text-base font-medium text-white">{session?.email ?? '未登录'}</p>
          </div>
          <div className="surface-panel px-4 py-3 text-sm">
            <p className="text-slate-400">Tenant ID</p>
            <p className="text-base font-mono text-white">{tenantId || (sessionLoading ? '拉取中…' : '尚未关联')}</p>
          </div>
          <div className="surface-panel px-4 py-3 text-sm">
            <p className="text-slate-400">合同统计</p>
            <p className="text-base text-white">{loading ? '加载中…' : `共 ${contracts.length} 份`}</p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-amber-300">{error}</p>}
        {sessionError && <p className="mt-2 text-sm text-red-400">{sessionError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <div key={item.label} className="surface-panel p-4">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
            <p className="text-xs text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="surface-card flex flex-wrap gap-3 p-4 text-sm text-slate-200">
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="搜索合同标题 / 对手方"
          className="min-w-[180px] flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2"
        >
          <option value="all">全部状态</option>
          {Object.keys(statusGroups).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={counterpartyFilter}
          onChange={(event) => setCounterpartyFilter(event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2"
        >
          <option value="">全部对手方</option>
          {counterparties.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={contractType}
          onChange={(event) => setContractType(event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2"
        >
          <option value="all">全部类型</option>
          {contractTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2">
          <span className="text-xs text-slate-400">最低风险</span>
          <input
            type="number"
            min={0}
            value={minRisk}
            onChange={(event) => setMinRisk(Number(event.target.value) || 0)}
            className="w-16 bg-transparent text-right text-sm text-white focus:outline-none"
          />
        </label>
        <button
          onClick={() => {
            setSearchTerm('');
            setStatusFilter('all');
            setCounterpartyFilter('');
            setContractType('all');
            setMinRisk(0);
          }}
          className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200"
        >
          重置筛选
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="surface-card p-0">
          <table className="surface-table min-w-full divide-y divide-white/5 text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">合同标题</th>
                <th className="px-4 py-3">对手方</th>
                <th className="px-4 py-3">当前状态</th>
                <th className="px-4 py-3">风险条目</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contracts.map((contract) => (
                <tr key={contract.id} className={focusedContract === contract.id ? 'bg-cyan-500/5' : undefined}>
                  <td className="px-4 py-3 font-medium text-white">
                    {contract.title}
                    {contract.contract_type && (
                      <p className="text-xs text-slate-400">类型：{contract.contract_type}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{contract.counterparty ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="surface-chip px-2 py-0.5 text-xs capitalize">{contract.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-cyan-300">{contract.risk_count}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(contract.created_at)}</td>
                  <td className="px-4 py-3 text-xs">
                    <Link
                      href={`/reports?contractId=${contract.id}&title=${encodeURIComponent(contract.title)}`}
                      className="text-cyan-300 hover:underline"
                    >
                      查看报告
                    </Link>
                    <span className="mx-1 text-slate-500">|</span>
                    <Link href={`/risks?contractId=${contract.id}`} className="text-cyan-300 hover:underline">
                      跳转风险
                    </Link>
                  </td>
                </tr>
              ))}
              {!contracts.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={5}>
                    暂无数据，请确认租户信息后点击刷新。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="surface-card p-5">
            <h3 className="text-lg font-semibold text-white">高风险合同</h3>
            <p className="text-sm text-slate-300">列出风险条目大于 0 的合同，方便立即跟进。</p>
            <div className="mt-4 space-y-3 text-sm">
              {riskyContracts.slice(0, 5).map((contract) => (
                <div key={contract.id} className="surface-panel bg-transparent px-3 py-2">
                  <p className="font-medium text-white">{contract.title}</p>
                  <p className="text-xs text-slate-400">
                    风险条目：{contract.risk_count} · 创建时间：{formatDate(contract.created_at)}
                  </p>
                </div>
              ))}
              {!riskyContracts.length && <p className="text-slate-400">目前没有高风险合同。</p>}
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="text-lg font-semibold text-white">状态分布</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {Object.entries(statusGroups).map(([status, count]) => (
                <li key={status} className="surface-panel flex items-center justify-between px-3 py-2">
                  <span className="capitalize text-white">{status}</span>
                  <span className="font-semibold text-cyan-200">{count}</span>
                </li>
              ))}
              {!contracts.length && <li className="text-slate-400">暂无合同状态统计。</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
