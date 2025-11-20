'use client';

import { useEffect, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type Insights = {
  totals: { contracts: number; risks: number; highRisks: number; openTasks: number };
  statuses: { contractStatus: Record<string, number>; riskLevel: Record<string, number> };
  tasks: { id: string; task_type: string; status: string; created_at: string }[];
  notifications: { id: string; message: string; created_at: string }[];
};

type Risk = {
  id: string;
  risk_level: string;
  risk_type: string | null;
  description: string | null;
  recommendation: string | null;
};

type Clause = {
  id: string;
  category: string;
  summary: string | null;
  contract_version: { contract: { title: string } | null } | null;
};

type ReportState = {
  insights: Insights | null;
  risks: Risk[];
  clauses: Clause[];
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `request failed: ${url}`);
  }
  return data;
};

export default function ReportsPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [state, setState] = useState<ReportState>({ insights: null, risks: [], clauses: [] });
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.tenant_id) return;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [insights, risksRes, clausesRes] = await Promise.all([
          fetchJson<Insights>('/api/insights'),
          fetchJson<{ risks: Risk[] }>('/api/risk-findings'),
          fetchJson<{ clauses: Clause[] }>('/api/key-clauses'),
        ]);
        setState({ insights, risks: risksRes.risks ?? [], clauses: clausesRes.clauses ?? [] });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, [session?.tenant_id]);

  const downloadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/export', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '导出失败');
      setReport(data.markdown ?? '');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Insight Reporter</p>
            <h1 className="text-3xl font-semibold">报告 / 简报</h1>
            <p className="text-sm text-slate-200">聚合 Risk Analyzer、Version Diff、Clause Rewrite 等结果，生成面向管理层或客户的洞察简报。</p>
          </div>
          <button className="rounded-2xl bg-cyan-400 px-5 py-2 text-slate-900 shadow-lg shadow-cyan-400/50" onClick={downloadReport} disabled={loading}>
            导出 PDF / HTML
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-300">{sessionLoading ? '获取用户信息…' : session ? `当前 tenant：${session.tenant_id ?? '-'}` : sessionError || '未登录'}</p>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/90 p-4 text-slate-900">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Contracts</p>
          <p className="mt-2 text-3xl font-semibold">{state.insights?.totals.contracts ?? '--'}</p>
          <p className="text-xs text-slate-500">在库合同</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/90 p-4 text-slate-900">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Risks</p>
          <p className="mt-2 text-3xl font-semibold">{state.insights?.totals.risks ?? '--'}</p>
          <p className="text-xs text-slate-500">高风险 {state.insights?.totals.highRisks ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/90 p-4 text-slate-900">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tasks</p>
          <p className="mt-2 text-3xl font-semibold">{state.insights?.totals.openTasks ?? '--'}</p>
          <p className="text-xs text-slate-500">未完成 Agent</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/90 p-4 text-slate-900">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Notices</p>
          <p className="mt-2 text-3xl font-semibold">{state.insights?.notifications.length ?? 0}</p>
          <p className="text-xs text-slate-500">最新通知</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">高风险回顾</h2>
          <ul className="mt-4 space-y-4 text-sm">
            {state.risks.slice(0, 6).map((risk) => (
              <li key={risk.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{risk.risk_level}</p>
                <p className="mt-1 font-semibold text-slate-900">{risk.risk_type ?? '未命名风险'}</p>
                <p className="text-slate-600">{risk.description ?? '暂无描述'}</p>
                {risk.recommendation && <p className="text-xs text-emerald-600">建议：{risk.recommendation}</p>}
              </li>
            ))}
            {!state.risks.length && <li className="text-slate-500">暂无风险数据，等待 Risk Analyzer 完成。</li>}
          </ul>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-xl">
          <h2 className="text-xl font-semibold">行动计划</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {state.insights?.tasks.slice(0, 5).map((task) => (
              <li key={task.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="font-semibold">{task.task_type}</p>
                <p className="text-xs text-slate-300">状态：{task.status} · {new Date(task.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
              </li>
            ))}
            {!state.insights?.tasks.length && <li className="text-slate-300">暂无任务记录</li>}
          </ul>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">关键条款摘要</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {state.clauses.slice(0, 6).map((clause) => (
            <div key={clause.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{clause.category}</p>
              <h3 className="mt-2 font-semibold">{clause.contract_version?.contract?.title ?? '未知合同'}</h3>
              <p className="text-xs text-slate-500">摘要：{clause.summary ?? '暂无'}</p>
            </div>
          ))}
          {!state.clauses.length && <p className="text-slate-500">暂无关键条款，请等待 Key Clause Extraction Agent 完成解析。</p>}
        </div>
      </section>

      {report && (
        <section className="rounded-3xl border border-white/10 bg-white/95 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">最新导出预览</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">{report}</pre>
        </section>
      )}
    </div>
  );
}
