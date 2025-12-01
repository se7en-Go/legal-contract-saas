'use client';

import { useFormStatus } from 'react-dom';

export const SubmitButton = () => {
  const { pending } = useFormStatus();
  const baseClasses =
    'w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-white shadow-lg shadow-emerald-500/40 transition hover:opacity-95';
  const disabledClasses = pending ? ' cursor-not-allowed opacity-70 hover:opacity-70' : '';

  return (
    <div className="space-y-2 text-center">
      <button type="submit" disabled={pending} className={baseClasses + disabledClasses}>
        {pending ? '发送中...' : '发送登录链接'}
      </button>
      <p className="text-xs text-slate-500">
        {pending ? '请查看邮箱并在 5 分钟内完成登录。' : '点击后将发送一次性登录链接到您的邮箱。'}
      </p>
    </div>
  );
};
