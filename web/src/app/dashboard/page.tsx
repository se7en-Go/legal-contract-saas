'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type InsightsResponse = {
  totals: {
    contracts: number;
    risks: number;
    highRisks: number;
    openTasks: number;
  };
  statuses: {
    contractStatus: Record<string, number>;
    riskLevel: Record<string, number>;
  };
  tasks: {
    id: string;
    task_type: string;
    status: string;
    progress: number | null;
    error: string | null;
    created_at: string;
    updated_at: string | null;
  }[];
  notifications: {
    id: string;
    entity: string | null;
    message: string;
    created_at: string;
  }[];
};

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

export default function DashboardPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/insights', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '获取仪表盘数据失败');
      setInsights(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.tenant_id) {
      void fetchInsights();
    }
  }, [session?.tenant_id, fetchInsights]);

  const metrics = [
    { label: '合同数量', value: insights?.totals.contracts ?? 0, hint: 'contracts 表实时统计' },
    { label: '风险记录', value: insights?.totals.risks ?? 0, hint: `高风险 ${insights?.totals.highRisks ?? 0}` },
    { label: '未完成任务', value: insights?.totals.openTasks ?? 0, hint: 'ingestion / OCR / LLM' },
  ];

  const taskPipelines = useMemo(() => {
    const tasks = insights?.tasks ?? [];
    const grouped = tasks.reduce<Record<string, typeof tasks>>((acc, task) => {
      acc[task.task_type] = acc[task.task_type] ?? [];
      acc[task.task_type].push(task);
      return acc;
    }, {});
    return Object.entries(grouped).map(([type, rows]) => ({
      type,
      latest: rows[0],
      pending: rows.filter((row) => row.status !== 'completed').length,
    }));
  }, [insights]);

  const riskLevels = insights?.statuses.riskLevel ?? {};
  const contractStatus = insights?.statuses.contractStatus ?? {};

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-white shadow-2xl">
        <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Admin Control</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">AI Agent 控制台</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          统一观测合同数量、风险趋势、任务队列与系统通知，帮助法务/风控团队快速定位异常，并与多智能体协同。
        </p>
        {(sessionLoading || loading) && <p className="mt-3 text-sm text-slate-300">加载中…</p>}
        {sessionError && <p className="mt-3 text-sm text-red-300">{sessionError}</p>}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/90 p-6 shadow-xl">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{metric.value}</p>
            <p className="mt-2 text-xs text-slate-400">{metric.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">合同 / 风险分布</h2>
            <button
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-cyan-300 hover:text-cyan-600"
              onClick={() => fetchInsights()}
              disabled={loading}
            >
              {loading ? '刷新中…' : '刷新数据'}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">合同状态</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {Object.entries(contractStatus).map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between">
                    <span className="capitalize">{status}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </li>
                ))}
                {!Object.keys(contractStatus).length && <li className="text-slate-400">暂无数据</li>}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">风险等级</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {Object.entries(riskLevels).map(([level, count]) => (
                  <li key={level} className="flex items-center justify-between">
                    <span className="capitalize">{level}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </li>
                ))}
                {!Object.keys(riskLevels).length && <li className="text-slate-400">暂无风险记录</li>}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-2xl">
          <h2 className="text-xl font-semibold">通知与审计</h2>
          <div className="mt-4 space-y-4 text-sm">
            {(insights?.notifications ?? []).map((item) => (
              <div key={item.id} className="border-l-2 border-cyan-300/70 pl-4">
                <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
                <p className="font-semibold">{item.entity ?? 'system'}</p>
                <p className="text-slate-300">{item.message}</p>
              </div>
            ))}
            {!insights?.notifications?.length && <p className="text-slate-400">暂无系统通知</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">Agent Pipeline</h2>
          <p className="text-sm text-slate-500">按任务类型查看排队情况，识别瓶颈。</p>
          <div className="mt-4 space-y-3 text-sm">
            {taskPipelines.map((pipeline) => (
              <div key={pipeline.type} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{pipeline.type}</span>
                  <span className="text-xs text-slate-500">未完成：{pipeline.pending}</span>
                </div>
                {pipeline.latest && (
                  <p className="text-xs text-slate-500">
                    最新任务：{formatDate(pipeline.latest.created_at)} · 状态 {pipeline.latest.status}
                  </p>
                )}
              </div>
            ))}
            {!taskPipelines.length && <p className="text-sm text-slate-500">暂无任务数据，可先在上传页触发。</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-2xl">
          <h2 className="text-xl font-semibold">LLM SLA 追踪</h2>
          <p className="text-sm text-slate-300">展示核心 Agent（风险识别、条款改写等）的响应概览。</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Completion</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {insights ? `${Math.max(92, 100 - (insights.totals.highRisks ?? 0))}%` : '—'}
              </p>
              <p className="text-xs text-slate-400">近 24 小时内按时完成率（模拟数据）</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Queue</p>
              <p className="mt-2 text-3xl font-semibold text-white">{insights?.totals.openTasks ?? 0}</p>
              <p className="text-xs text-slate-400">当前队列中的任务数</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
