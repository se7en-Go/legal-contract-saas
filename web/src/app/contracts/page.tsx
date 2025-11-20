'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type Contract = {
  id: string;
  title: string;
  status: string;
  counterparty: string | null;
  created_at: string;
  risk_count: number;
};

export default function ContractsPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const tenantId = session?.tenant_id ?? '';
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!tenantId) {
      setError('未获取到 tenant_id，无法拉取合同列表');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts?tenantId=${tenantId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载合同数据失败');
      setContracts(data.contracts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      fetchContracts();
    }
  }, [tenantId, fetchContracts]);

  const totalRisks = contracts.reduce((sum, contract) => sum + contract.risk_count, 0);
  const riskyContracts = contracts.filter((c) => c.risk_count > 0);
  const statusGroups = useMemo(() => {
    return contracts.reduce<Record<string, number>>((acc, contract) => {
      acc[contract.status] = (acc[contract.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [contracts]);

  const summaryCards = [
    { label: '合同总数', value: contracts.length.toString(), hint: '当前租户的合同记录' },
    { label: '涉及风险', value: riskyContracts.length.toString(), hint: `累计风险项 ${totalRisks} 条` },
    { label: '状态覆盖', value: Object.keys(statusGroups).length.toString(), hint: '处于不同阶段的合同' },
  ];

  const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">合同总览</h2>
            <p className="text-sm text-slate-500">系统根据 tenant_id 自动加载对应合同，确认租户正确后即可查看 AI 审核最新结果。</p>
          </div>
          <button
            onClick={fetchContracts}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            disabled={loading || !tenantId}
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>当前用户</p>
            <p className="text-base font-medium text-slate-900">{session?.email ?? '未登录'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>Tenant ID</p>
            <p className="text-base font-mono text-slate-900">{tenantId || (sessionLoading ? '拉取中…' : '尚未关联')}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>合同统计</p>
            <p className="text-base text-slate-900">{loading ? '加载中…' : `共 ${contracts.length} 份`}</p>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {sessionError && <p className="mt-2 text-sm text-red-600">{sessionError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/30 bg-slate-900/90 p-4 text-white shadow">
            <p className="text-sm text-slate-300">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold">{item.value}</p>
            <p className="text-xs text-slate-400">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-lg shadow-slate-200/50">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">合同标题</th>
                <th className="px-4 py-3">对手方</th>
                <th className="px-4 py-3">当前状态</th>
                <th className="px-4 py-3">风险条目</th>
                <th className="px-4 py-3">创建时间</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{contract.title}</td>
                    <td className="px-4 py-3 text-slate-600">{contract.counterparty ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs capitalize text-slate-700">
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{contract.risk_count}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(contract.created_at)}</td>
                  </tr>
                ))}
                {!contracts.length && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                      暂无数据，请确认 tenant_id 是否正确并点击刷新。
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-5 text-white shadow-lg">
            <h3 className="text-lg font-semibold">高风险合同</h3>
            <p className="text-sm text-slate-300">列出风险条目大于 0 的合同，方便立即跟进。</p>
            <div className="mt-4 space-y-3 text-sm">
              {riskyContracts.slice(0, 5).map((contract) => (
                <div key={contract.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="font-medium">{contract.title}</p>
                  <p className="text-xs text-slate-300">
                    风险条目：{contract.risk_count} · 创建时间：{formatDate(contract.created_at)}
                  </p>
                </div>
              ))}
              {!riskyContracts.length && <p className="text-slate-300">目前没有高风险合同</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">状态分布</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {Object.entries(statusGroups).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="capitalize">{status}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </li>
              ))}
              {!contracts.length && <li className="text-slate-400">暂无任何状态统计</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
