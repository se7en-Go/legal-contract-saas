'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';

type TaskInfo = Record<string, unknown> | null;

export default function UploadPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [tenantOverride, setTenantOverride] = useState('');
  const tenantId = tenantOverride || session?.tenant_id || '';
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [taskInfo, setTaskInfo] = useState<TaskInfo>(null);
  const [loading, setLoading] = useState(false);
  const [watchTaskId, setWatchTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);

  const toErrorMessage = (value: unknown) => {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const maybeMessage = (value as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') return maybeMessage;
      try {
        return JSON.stringify(value);
      } catch {
        return '未知错误';
      }
    }
    return '未知错误';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session) {
      setStatus('未登录，无法提交合同');
      return;
    }
    if (!tenantId || !title || !file) {
      setStatus('请填写基本信息并选择合同文件');
      return;
    }
    setLoading(true);
    setStatus(null);
    setTaskInfo(null);
    try {
      const formData = new FormData();
      formData.append('tenantId', tenantId);
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(toErrorMessage(uploadJson.error ?? uploadJson));

      const ingestRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          title,
          counterparty,
          storage_path: uploadJson.path,
          metadata: { uploaded_via: 'web' },
        }),
      });
      const ingestJson = await ingestRes.json();
      if (!ingestRes.ok) throw new Error(toErrorMessage(ingestJson.error ?? ingestJson));

      setTaskInfo(ingestJson);
      setWatchTaskId(ingestJson.task_id ?? null);
      setTaskStatus('queued');
      setStatus('上传成功，AI 正在解析条款并触发后续任务，请稍后在“任务状态”或“合同库”查看结果。');
      setTitle('');
      setCounterparty('');
      setFile(null);
    } catch (err) {
      setStatus(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!watchTaskId) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tasks?taskId=${watchTaskId}`, { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          const rows = data.tasks ?? [];
          if (rows.length) {
            setTaskStatus(rows[0].status);
            if (rows[0].status === 'completed' || rows[0].status === 'failed') {
              return true;
            }
          }
        }
      } catch {
        // ignore polling errors
      }
      return false;
    };

    let interval: number | undefined;
    const start = async () => {
      const done = await poll();
      if (done) return;
      interval = window.setInterval(async () => {
        const finished = await poll();
        if (finished && interval) {
          window.clearInterval(interval);
        }
      }, 5000);
    };
    void start();
    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };
  }, [watchTaskId]);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr,1fr] text-slate-50">
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl">
        <div className="mb-6 space-y-1">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Upload</p>
          <h2 className="text-2xl font-semibold text-white">上传合同</h2>
          <p className="text-sm text-slate-400">支持 PDF / Word，点击上传后系统会自动调用 OCR + Agent 分析。</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Tenant ID</label>
            <input
              value={tenantId}
              onChange={(e) => setTenantOverride(e.target.value.trim())}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder={sessionLoading ? '正在获取…' : '可手动填写租户 ID'}
            />
            <p className="mt-1 text-xs text-slate-400">
              {session
                ? session.tenant_id
                  ? `当前用户：${session.email}`
                  : '当前用户未绑定租户，可手动填写 Tenant ID。'
                : sessionError || '未登录'}
            </p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">合同标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="如：2025 年度服务协议"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">对手方（可选）</label>
            <input
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="例如：某科技有限公司"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">合同文件</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full cursor-pointer rounded-xl border border-dashed border-white/20 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-xs file:text-cyan-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !session || !tenantId}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 px-4 py-3 text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '上传中…' : '上传并启动解析'}
          </button>
        </form>
        {status && (
          <p className={`mt-4 text-sm ${status.includes('成功') ? 'text-emerald-300' : 'text-amber-300'}`}>
            {status}
          </p>
        )}
        {watchTaskId && (
          <p className="mt-2 text-sm text-slate-300">
            任务 {watchTaskId.slice(0, 8)} 状态：{taskStatus ?? '查询中'}
            <Link href={`/tasks?highlight=${watchTaskId}`} className="ml-2 text-cyan-300 hover:underline">
              查看详情
            </Link>
          </p>
        )}
        {sessionError && <p className="mt-2 text-sm text-red-400">{sessionError}</p>}
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">任务响应</h3>
        <p className="text-sm text-slate-400">系统会返回 contract_id / version_id / task_id，便于前往任务中心跟踪。</p>
        {taskInfo ? (
          <pre className="mt-4 max-h-[400px] overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs text-emerald-100">
            {JSON.stringify(taskInfo, null, 2)}
          </pre>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-4 text-sm text-slate-400">
            提交后会在此展示 ingest-doc 返回的 JSON 响应。
          </p>
        )}
      </div>
    </div>
  );
}
