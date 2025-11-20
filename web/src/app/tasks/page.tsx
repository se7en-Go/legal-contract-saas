'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type TaskRow = {
  id: string;
  task_type: string;
  status: string;
  progress: number | null;
  error: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
};

const statusLabels: Record<string, string> = {
  queued: '排队中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

const statusColors: Record<string, string> = {
  queued: 'border-amber-200 bg-amber-100/40 text-amber-800',
  running: 'border-blue-200 bg-blue-100/40 text-blue-800',
  completed: 'border-emerald-200 bg-emerald-100/40 text-emerald-800',
  failed: 'border-red-200 bg-red-100/40 text-red-800',
};

export default function TasksPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!session?.tenant_id) return;
    const controller = new AbortController();
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/tasks', window.location.origin);
        if (filter !== 'all') url.searchParams.set('status', filter);
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '获取任务失败');
        setTasks(data.tasks ?? []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void fetchTasks();
    return () => controller.abort();
  }, [session?.tenant_id, filter]);

  const grouped = useMemo(() => {
    return tasks.reduce<Record<string, TaskRow[]>>((acc, task) => {
      acc[task.task_type] = acc[task.task_type] ?? [];
      acc[task.task_type].push(task);
      return acc;
    }, {});
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Task Runner</p>
            <h1 className="text-2xl font-semibold text-slate-900">任务状态</h1>
            <p className="text-sm text-slate-500">追踪合同上传、OCR、LLM 风险分析、条款改写等任务的实时进度。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['all', 'queued', 'running', 'completed', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`rounded-full border px-4 py-1 ${
                  filter === status ? 'border-cyan-500 text-cyan-700 bg-cyan-100' : 'border-slate-200 text-slate-600'
                }`}
              >
                {status === 'all' ? '全部' : statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {sessionLoading ? '正在获取用户信息…' : session ? `当前 tenant：${session.tenant_id ?? '-'}` : sessionError || '未登录'}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">任务类型</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">Payload / 错误</th>
                <th className="px-4 py-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{task.task_type}</p>
                    <p className="text-xs text-slate-400">#{task.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusColors[task.status] ?? 'border-slate-200'}`}>
                      {statusLabels[task.status] ?? task.status}
                    </span>
                    {typeof task.progress === 'number' && (
                      <p className="text-xs text-slate-500">进度：{Math.round(task.progress * 100) / 100}%</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {task.error ? (
                      <span className="text-red-600">{task.error}</span>
                    ) : (
                      <pre className="max-h-24 overflow-auto rounded-xl bg-slate-50 p-2 text-slate-500">{JSON.stringify(task.payload ?? {}, null, 2)}</pre>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p>创建：{new Date(task.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
                    {task.updated_at && <p>更新：{new Date(task.updated_at).toLocaleString('zh-CN', { hour12: false })}</p>}
                  </td>
                </tr>
              ))}
              {!tasks.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    {loading ? '加载中…' : '暂无任务记录，可通过“上传合同”触发新的任务。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-lg">
            <h3 className="text-lg font-semibold">最新任务时间线</h3>
            <div className="mt-4 space-y-4 text-sm">
              {tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="border-l-2 border-cyan-300/70 pl-4">
                  <p className="text-xs text-slate-400">{new Date(task.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
                  <p className="font-semibold">{task.task_type}</p>
                  <p className="text-slate-300">状态：{statusLabels[task.status] ?? task.status}</p>
                </div>
              ))}
              {!tasks.length && <p className="text-slate-400">暂无任务，如需测试可前往上传页面。</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Agent 运行概览</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {Object.entries(grouped).map(([type, rows]) => (
                <li key={type} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">{type}</p>
                  <p className="text-xs text-slate-500">
                    总数 {rows.length} · 未完成 {rows.filter((row) => row.status !== 'completed').length}
                  </p>
                </li>
              ))}
              {!tasks.length && <li className="text-slate-400">等待任务进入队列后方可统计。</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
