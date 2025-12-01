'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTenantSession } from '@/hooks/use-tenant-session';

type ReportCache = {
  markdown: string;
  error?: string;
};

type TaskSummary = {
  id: string;
  task_type: string;
  status: string;
  created_at: string;
};

export default function ReportsPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [dateRange, setDateRange] = useState('30d');
  const [contractType, setContractType] = useState('all');
  const [contractId, setContractId] = useState(searchParams.get('contractId') ?? '');
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    if (!markdown) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(markdown);
    } finally {
      setCopying(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'insight-report.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchTasks = useCallback(async () => {
    if (!session?.tenant_id) return;
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setTasks((data.tasks ?? []).slice(0, 5));
      }
    } catch {
      // 忽略任务预览错误
    }
  }, [session?.tenant_id]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setMarkdown(null);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateRange, contractType, contractId: contractId || undefined }),
      });
      const data: ReportCache = await res.json();
      if (!res.ok) throw new Error(data?.markdown || data?.error || '导出失败');
      setMarkdown(data.markdown);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Insight Reporter</p>
            <h1 className="text-2xl font-semibold text-white">洞察报告</h1>
            <p className="text-sm text-slate-400">聚合合同、风险、任务等数据，由 Insight Reporter Agent 输出 Markdown 报告。</p>
          </div>
          <button
            disabled={exporting}
            onClick={handleExport}
            className="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 disabled:opacity-50"
          >
            {exporting ? '生成中…' : '生成报告'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2"
          >
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
            <option value="90d">近 90 天</option>
          </select>
          <input
            value={contractType}
            onChange={(event) => setContractType(event.target.value || 'all')}
            placeholder="合同类型（metadata->type）"
            className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <input
            value={contractId}
            onChange={(event) => setContractId(event.target.value)}
            placeholder="指定合同 ID（可选）"
            className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div className="mt-3 text-xs text-slate-400">
          {sessionLoading ? '正在获取用户信息…' : session ? `当前用户：${session.email}` : sessionError || '未登录'}
        </div>
        {error && <p className="mt-2 text-sm text-amber-300">{error}</p>}
      </div>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">报告内容预览</h2>
            {markdown && (
              <div className="flex gap-2 text-xs">
                <button
                  onClick={handleCopy}
                  disabled={copying}
                  className="surface-chip px-3 py-1 disabled:opacity-40"
                >
                  {copying ? '复制中…' : '复制 Markdown'}
                </button>
                <button onClick={handleDownloadMarkdown} className="surface-chip px-3 py-1">
                  下载 Markdown
                </button>
              </div>
            )}
          </div>
          {markdown ? (
            <pre className="mt-4 max-h-[480px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
              {markdown}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              点击“生成报告”后，这里会展示 Insight Reporter 返回的 Markdown 内容，便于复制或导出。
            </p>
          )}
        </div>

        <div className="surface-card p-6">
          <h3 className="text-lg font-semibold text-white">最近任务</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {tasks.map((task) => (
              <li key={task.id} className="surface-panel flex flex-col gap-1 px-4 py-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{task.task_type}</span>
                  <span className="surface-chip px-2 py-0.5 text-xs uppercase">{task.status}</span>
                </div>
                <p className="text-xs text-slate-400">{new Date(task.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
              </li>
            ))}
            {!tasks.length && <li className="text-slate-400">暂无任务信息。</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
