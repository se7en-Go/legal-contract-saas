'use client';

import { useCallback, useState } from 'react';

type Contract = {
  id: string;
  title: string;
  status: string;
  counterparty: string | null;
  created_at: string;
  risk_count: number;
};

export default function ContractsPage() {
  const [tenantId, setTenantId] = useState('');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!tenantId) {
      setError('请输入 tenant_id');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts?tenantId=${tenantId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setContracts(data.contracts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <h2 className="text-xl font-semibold text-slate-900">合同巡航</h2>
        <p className="text-sm text-slate-500">输入 tenant_id，系统会显示该客户的所有合同及当前 AI 审核状况。</p>
        <div className="mt-4 flex gap-3">
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="tenant_id"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-slate-700 shadow-inner focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={fetchContracts}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? '加载中…' : '加载'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-lg shadow-slate-200/50">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">标题</th>
              <th className="px-4 py-3">对方</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">风险条数</th>
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
                <td className="px-4 py-3 text-slate-500">
                  {new Date(contract.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {!contracts.length && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  暂无数据，先输入 tenant_id 并点击加载。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
