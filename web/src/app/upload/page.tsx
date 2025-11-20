'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [tenantId, setTenantId] = useState('');
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [taskInfo, setTaskInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tenantId || !title || !file) {
      setStatus('请填写完整信息并选择文件');
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
      if (!uploadRes.ok) throw new Error(uploadJson.error || '上传失败');

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
      if (!ingestRes.ok) throw new Error(ingestJson.error || 'ingest-doc 调用失败');

      setTaskInfo(ingestJson);
      setStatus('上传成功，AI 正在解析条款。稍后在「合同监控」查看结果。');
      setTitle('');
      setCounterparty('');
      setFile(null);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-3xl border border-white/10 bg-white/90 p-8 shadow-xl">
        <div className="mb-6 space-y-1">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Upload</p>
          <h2 className="text-2xl font-semibold text-slate-900">上传合同</h2>
          <p className="text-sm text-slate-500">选择 PDF/Word，即可发起 OCR + 解析任务。</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">Tenant ID</label>
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">合同标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">对方 (可选)</label>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">合同文件</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-3 text-white shadow-lg shadow-blue-600/40 disabled:opacity-60">
            {loading ? '上传中…' : '上传并创建任务'}
          </button>
        </form>
        {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/80 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">最新任务</h3>
        <p className="text-sm text-slate-500">系统会自动记录 contract_id / version / task_id，便于排查。</p>
        {taskInfo ? (
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
            {JSON.stringify(taskInfo, null, 2)}
          </pre>
        ) : (
          <p className="mt-4 text-sm text-slate-500">尚无任务，提交表单后将在此显示。</p>
        )}
      </div>
    </div>
  );
}
