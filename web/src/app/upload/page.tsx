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
      setStatus('请填写 tenant_id、合同标题并选择文件。');
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
      setStatus('上传成功，已创建解析任务。稍后在 Contracts 页面查看结果。');
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
    <div className='space-y-6'>
      <div className='rounded-xl border bg-white p-6 shadow-sm'>
        <h2 className='text-lg font-semibold'>上传合同</h2>
        <p className='text-sm text-slate-500'>系统会自动将文件存入 Supabase Storage，并触发 ingest 任务。</p>

        <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
          <div>
            <label className='text-sm text-slate-600'>Tenant ID</label>
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className='mt-1 w-full rounded-lg border px-3 py-2' />
          </div>
          <div>
            <label className='text-sm text-slate-600'>合同标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className='mt-1 w-full rounded-lg border px-3 py-2' />
          </div>
          <div>
            <label className='text-sm text-slate-600'>对方（可选）</label>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className='mt-1 w-full rounded-lg border px-3 py-2' />
          </div>
          <div>
            <label className='text-sm text-slate-600'>合同文件</label>
            <input type='file' onChange={(e) => setFile(e.target.files?.[0] ?? null)} className='mt-1 w-full text-sm' />
          </div>
          <button type='submit' disabled={loading} className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-60'>
            {loading ? '上传中…' : '上传并创建任务'}
          </button>
        </form>
        {status && <p className='mt-4 text-sm text-slate-600'>{status}</p>}
        {taskInfo && (
          <pre className='mt-4 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100'>
            {JSON.stringify(taskInfo, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
