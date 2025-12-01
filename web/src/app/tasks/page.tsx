'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTenantSession } from '@/hooks/use-tenant-session';

type TaskRow = {
  id: string;
  task_type: string;
  status: string;
  progress: number | null;
  error: string | null;
  last_error: string | null;
  retry_count: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
};

type TaskAttempt = {
  id: string;
  attempt_no: number;
  status: string;
  message: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  queued: '排队中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

const statusChips: Record<string, string> = {
  queued: 'surface-chip text-amber-200 border-amber-300/40',
  running: 'surface-chip text-cyan-200 border-cyan-300/40',
  completed: 'surface-chip text-emerald-200 border-emerald-300/40',
  failed: 'surface-chip text-rose-200 border-rose-300/40',
};

const deriveProgress = (task: TaskRow) => {
  if (typeof task.progress === 'number') {
    return Math.round(task.progress * 100) / 100;
  }
  if (task.status === 'completed') {
    return 100;
  }
  return null;
};

export default function TasksPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [filter, setFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

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
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
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

  const highlightId = searchParams.get('highlight');

  const handleViewAttempts = async (task: TaskRow) => {
    setSelectedTask(task);
    setAttempts([]);
    setAttemptsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/attempts`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '获取重试记录失败');
      setAttempts(data.attempts ?? []);
    } catch (err) {
      setActionMessage({ text: (err as Error).message, tone: 'error' });
    } finally {
      setAttemptsLoading(false);
    }
  };

  const handleRequeue = async (task: TaskRow) => {
    setActionMessage(null);
    try {
      const res = await fetch('/api/tasks/requeue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '重新排队失败');
      setActionMessage({ text: `任务 ${task.task_type} 已重新排队`, tone: 'info' });
      setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, status: 'queued', last_error: null } : row)));
    } catch (err) {
      setActionMessage({ text: (err as Error).message, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Task Runner</p>
            <h1 className="text-2xl font-semibold text-white">任务状态</h1>
            <p className="text-sm text-slate-400">追踪合同上传、OCR、LLM 风险分析等任务的实时进度。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['all', 'queued', 'running', 'completed', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`surface-chip px-4 py-1 text-xs uppercase tracking-wide ${
                  filter === status ? 'border-cyan-300/70 text-cyan-100' : 'text-slate-300'
                }`}
              >
                {status === 'all' ? '全部' : statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {sessionLoading ? '正在获取用户信息…' : session ? `当前 tenant：${session.tenant_id ?? '-'}` : sessionError || '未登录'}
        </p>
        {error && <p className="mt-2 text-sm text-amber-300">{error}</p>}
        {actionMessage && (
          <p className={`mt-2 text-sm ${actionMessage.tone === 'error' ? 'text-rose-300' : 'text-cyan-200'}`}>
            {actionMessage.text}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="surface-card p-0">
          <table className="surface-table min-w-full divide-y divide-white/5 text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">任务类型</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">Payload / 错误</th>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tasks.map((task) => (
                <tr key={task.id} className={highlightId === task.id ? 'bg-cyan-500/5' : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{task.task_type}</p>
                    <p className="text-xs text-slate-400">#{task.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`${statusChips[task.status] ?? 'surface-chip text-slate-200'} px-3 py-1 text-xs`}>
                      {statusLabels[task.status] ?? task.status}
                    </span>
                    <p className="text-xs text-slate-400">重试：{task.retry_count ?? 0}</p>
                    {(() => {
                      const progress = deriveProgress(task);
                      if (progress === null) return null;
                      return <p className="text-xs text-slate-400">进度：{progress}%</p>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {task.last_error && <p className="text-rose-300">最后错误：{task.last_error}</p>}
                    {task.error ? (
                      <span className="text-rose-300">{task.error}</span>
                    ) : (
                      <pre className="max-h-24 overflow-auto rounded-xl border border-white/10 bg-slate-950/60 p-2 text-slate-300">
                        {JSON.stringify(task.payload ?? {}, null, 2)}
                      </pre>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <p>创建：{new Date(task.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
                    {task.updated_at && <p>更新：{new Date(task.updated_at).toLocaleString('zh-CN', { hour12: false })}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-200">
                    <div className="flex flex-col gap-2">
                      <button className="text-cyan-300 hover:underline" onClick={() => void handleViewAttempts(task)}>
                        查看日志
                      </button>
                      <button
                        className="text-amber-300 hover:underline disabled:opacity-40"
                        disabled={task.status === 'queued'}
                        onClick={() => void handleRequeue(task)}
                      >
                        重新排队
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!tasks.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    {loading ? '加载中…' : '暂无任务记录，可前往“上传合同”触发新的任务。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white">最新任务时间线</h3>
            <div className="mt-4 space-y-4 text-sm">
              {tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="border-l-2 border-cyan-300/70 pl-4">
                  <p className="text-xs text-slate-400">{new Date(task.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
                  <p className="font-semibold text-white">{task.task_type}</p>
                  <p className="text-slate-300">状态：{statusLabels[task.status] ?? task.status}</p>
                </div>
              ))}
              {!tasks.length && <p className="text-slate-400">暂无任务，如需测试可前往上传页面。</p>}
            </div>
          </div>

          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white">Agent 运行概览</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {Object.entries(grouped).map(([type, rows]) => (
                <li key={type} className="surface-panel flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">{type}</p>
                    <p className="text-xs text-slate-400">总数 {rows.length}</p>
                  </div>
                  <p className="text-xs text-slate-300">未完成 {rows.filter((row) => row.status !== 'completed').length}</p>
                </li>
              ))}
              {!tasks.length && <li className="text-slate-400">等待任务进入队列后方可统计。</li>}
            </ul>
          </div>
        </div>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-6 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">任务日志</p>
                <h4 className="text-lg font-semibold text-white">{selectedTask.task_type}</h4>
                <p className="text-xs text-slate-500">#{selectedTask.id}</p>
              </div>
              <button
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300 hover:border-cyan-400/60"
                onClick={() => {
                  setSelectedTask(null);
                  setAttempts([]);
                }}
              >
                关闭
              </button>
            </div>
            <div className="mt-4 max-h-[320px] space-y-3 overflow-auto">
              {attemptsLoading && <p className="text-slate-400">加载中…</p>}
              {!attemptsLoading && !attempts.length && <p className="text-slate-500">暂无重试记录</p>}
              {attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs text-slate-400">尝试 #{attempt.attempt_no}</p>
                  <p className="font-semibold text-white">{statusLabels[attempt.status] ?? attempt.status}</p>
                  <p className="text-xs text-slate-500">{new Date(attempt.created_at).toLocaleString('zh-CN', { hour12: false })}</p>
                  {attempt.message && <p className="text-rose-300">{attempt.message}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
