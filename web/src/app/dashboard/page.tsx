'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantSession } from '@/hooks/use-tenant-session';
import { RISK_LEVEL_LABELS, RiskLevel, normalizeRiskLevel } from '@/lib/risk-level';

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
  sla?: {
    windowHours: number;
    successRate: number | null;
    averageCompletionSeconds: number | null;
    totalAttempts: number;
    succeededAttempts: number;
  };
  tasks: {
    id: string;
    task_type: string;
    status: string;
    progress: number | null;
    error: string | null;
    last_error: string | null;
    retry_count: number | null;
    created_at: string;
    updated_at: string | null;
  }[];
  notifications: {
    id: string;
    entity: string | null;
    message: string;
    severity: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }[];
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  uploaded: '已上传',
  ingesting: '解析中',
  processing: '解析中',
  parsed: '已拆条',
  completed: '已完成',
  processed: '已完成',
  failed: '失败',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  ingestion: '文档入库',
  'ingest-doc': '文档入库',
  'task-runner': '任务编排',
  'risk-analyzer': '风险识别',
  'key-clause-extractor': '关键条款提取',
  'insight-reporter': '洞察报告',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  pending: '排队中',
  running: '执行中',
  processing: '执行中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
};

const SEVERITY_LABELS: Record<string, string> = {
  info: '提示',
  success: '成功',
  warning: '警告',
  warn: '警告',
  error: '错误',
  critical: '严重',
};

const OPS_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/(ingestion|ingest-doc)/gi, '解析入库'],
  [/(task-runner)/gi, '任务编排'],
  [/(risk-analyzer)/gi, '风险识别'],
  [/(key-clause-extractor)/gi, '关键条款提取'],
  [/(insight-reporter)/gi, '洞察报告'],
  [/(ocr)/gi, 'OCR 识别'],
];

const translateContractStatus = (value: string) => {
  const key = value?.toLowerCase?.() ?? value;
  return CONTRACT_STATUS_LABELS[key] ?? value ?? '未知状态';
};

const translateTaskType = (value: string) => {
  const key = value?.toLowerCase?.() ?? value;
  return TASK_TYPE_LABELS[key] ?? value ?? '未知任务';
};

const translateTaskStatus = (value: string) => {
  const key = value?.toLowerCase?.() ?? value;
  return TASK_STATUS_LABELS[key] ?? value ?? '未知状态';
};

const translateSeverity = (value: string) => {
  const key = value?.toLowerCase?.() ?? value;
  return SEVERITY_LABELS[key] ?? value ?? '通知';
};

const sanitizeOpsText = (value?: string | null) => {
  if (!value) return '—';
  let result = value.replace(/\uFFFD+/g, '');
  OPS_TERM_REPLACEMENTS.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  result = result.replace(/failed/gi, '失败').replace(/completed/gi, '完成');
  return result.trim() || value;
};

const formatNotificationMessage = (notification: InsightsResponse['notifications'][number]) => {
  let text = sanitizeOpsText(notification.message);
  const taskMatch = /^task:([a-z0-9-]+)/i.exec(text);
  if (taskMatch) {
    text = text.replace(/^task:[a-z0-9-]+/i, `任务 ${taskMatch[1]}`);
  }
  const metadataNote =
    notification.metadata && typeof notification.metadata === 'object'
      ? (notification.metadata as Record<string, unknown>).note
      : null;
  if (typeof metadataNote === 'string') {
    text = `${text} · ${sanitizeOpsText(metadataNote)}`;
  }
  return text;
};

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

export default function DashboardPage() {
  const { session, loading: sessionLoading, error: sessionError } = useTenantSession();
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notificationSeverity, setNotificationSeverity] = useState('all');

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

  useEffect(() => {
    if (!autoRefresh) return;
    if (!session?.tenant_id) return;
    const interval = window.setInterval(() => {
      void fetchInsights();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, session?.tenant_id, fetchInsights]);

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

  const sla = insights?.sla;

  const contractStatusEntries = useMemo(() => {
    const source = insights?.statuses.contractStatus ?? {};
    return Object.entries(source).map(([status, count]) => ({
      label: translateContractStatus(status),
      count,
    }));
  }, [insights?.statuses.contractStatus]);

  const riskLevelEntries = useMemo(() => {
    const source = insights?.statuses.riskLevel ?? {};
    const bucket: Record<string, number> = {};
    Object.entries(source).forEach(([level, count]) => {
      const normalized = normalizeRiskLevel(level);
      const label = normalized ? RISK_LEVEL_LABELS[normalized] : level;
      bucket[label] = (bucket[label] ?? 0) + count;
    });
    const ordered: Array<{ label: string; count: number }> = [];
    (['high', 'medium', 'low'] as RiskLevel[]).forEach((lvl) => {
      const label = RISK_LEVEL_LABELS[lvl];
      if (bucket[label]) {
        ordered.push({ label, count: bucket[label] });
        delete bucket[label];
      }
    });
    return [...ordered, ...Object.entries(bucket).map(([label, count]) => ({ label, count }))];
  }, [insights?.statuses.riskLevel]);

  const severityOptions = useMemo(() => {
    const base = new Set((insights?.notifications ?? []).map((item) => item.severity ?? 'info'));
    return ['all', ...Array.from(base)];
  }, [insights?.notifications]);

  const filteredNotifications = useMemo(() => {
    const rows = insights?.notifications ?? [];
    if (notificationSeverity === 'all') return rows;
    return rows.filter((item) => item.severity === notificationSeverity);
  }, [notificationSeverity, insights?.notifications]);

  const recentFailures = useMemo(() => {
    return (insights?.tasks ?? []).filter((task) => task.status === 'failed').slice(0, 4);
  }, [insights?.tasks]);

  const formatSeconds = (seconds: number | null | undefined) => {
    if (!seconds) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}min`;
  };

  const resolveNotificationLink = (entity: string | null) => {
    if (!entity) return null;
    if (entity.startsWith('task:')) {
      return `/tasks?highlight=${entity.split(':')[1] ?? ''}`;
    }
    if (entity.startsWith('contract:')) {
      return `/contracts?focus=${entity.split(':')[1] ?? ''}`;
    }
    if (entity.startsWith('risk:')) {
      return `/risks?riskId=${entity.split(':')[1] ?? ''}`;
    }
    if (entity.startsWith('regulation')) {
      return '/regulations';
    }
    return null;
  };

  const severityClass = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-rose-400/60 text-rose-200';
      case 'warning':
        return 'border-amber-400/60 text-amber-200';
      case 'success':
        return 'border-emerald-400/60 text-emerald-200';
      default:
        return 'border-cyan-400/40 text-cyan-100';
    }
  };

  return (
    <div className="space-y-8 text-slate-100">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-10 text-white shadow-2xl">
        <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Admin Control</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">AI Agent 控制台</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          统一观测合同数量、风险趋势、任务队列与系统通知，帮助法务/风控团队快速定位异常，并与多智能体协同。
        </p>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-transparent text-cyan-400"
            />
            自动刷新（15s）
          </label>
          <button
            className="text-cyan-300 underline-offset-2 hover:underline disabled:opacity-50"
            onClick={() => fetchInsights()}
            disabled={loading}
          >
            手动刷新
          </button>
        </div>
        {(sessionLoading || loading) && <p className="mt-3 text-sm text-slate-400">加载中…</p>}
        {sessionError && <p className="mt-3 text-sm text-rose-300">{sessionError}</p>}
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="surface-panel p-6">
            <p className="text-sm text-slate-300">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
            <p className="mt-2 text-xs text-slate-400">{metric.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">合同 / 风险分布</h2>
            <button
              className="surface-chip border-cyan-300/80 px-3 py-1 text-xs text-cyan-100 hover:scale-105 disabled:opacity-40"
              onClick={() => fetchInsights()}
              disabled={loading}
            >
              {loading ? '刷新中…' : '刷新数据'}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="surface-panel p-4">
              <p className="text-sm text-slate-300">合同状态</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {contractStatusEntries.map((item) => (
                  <li key={item.label} className="flex items-center justify-between">
                    <span className="text-white">{item.label}</span>
                    <span className="font-semibold text-cyan-200">{item.count}</span>
                  </li>
                ))}
                {!contractStatusEntries.length && <li className="text-slate-500">暂无数据</li>}
              </ul>
            </div>
            <div className="surface-panel p-4">
              <p className="text-sm text-slate-300">风险等级</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {riskLevelEntries.map((item) => (
                  <li key={item.label} className="flex items-center justify-between">
                    <span className="text-white">{item.label}</span>
                    <span className="font-semibold text-rose-200">{item.count}</span>
                  </li>
                ))}
                {!riskLevelEntries.length && <li className="text-slate-500">暂无风险记录</li>}
              </ul>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">通知与审批</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {severityOptions.map((item) => (
                <button
                  key={item}
                  onClick={() => setNotificationSeverity(item)}
                  className={`surface-chip px-3 py-1 uppercase tracking-wide ${
                    notificationSeverity === item ? 'border-cyan-400/80 text-cyan-100' : 'text-slate-400'
                  }`}
                >
                  {item === 'all' ? '全部' : translateSeverity(item)}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            {filteredNotifications.map((item) => {
              const href = resolveNotificationLink(item.entity);
              return (
                <div key={item.id} className={`border-l-2 pl-4 ${severityClass(item.severity)}`}>
                  <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
                  <p className="font-semibold text-white">{sanitizeOpsText(item.entity ?? '系统')}</p>
                  <p className="text-slate-300">{formatNotificationMessage(item)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="surface-chip px-2 py-0.5 capitalize">{translateSeverity(item.severity)}</span>
                    {href ? (
                      <Link href={href} className="text-cyan-300 underline-offset-2 hover:underline">
                        查看详情
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!filteredNotifications.length && <p className="text-slate-400">暂无系统通知</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="text-xl font-semibold text-white">Agent 调度管道</h2>
          <p className="text-sm text-slate-400">按任务类型查看排队情况，快速识别瓶颈。</p>
          <div className="mt-4 space-y-3 text-sm">
            {taskPipelines.map((pipeline) => (
              <div key={pipeline.type} className="surface-panel px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{translateTaskType(pipeline.type)}</span>
                  <span className="text-xs text-slate-400">未完成：{pipeline.pending}</span>
                </div>
                {pipeline.latest && (
                  <p className="text-xs text-slate-400">
                    最新任务：{formatDate(pipeline.latest.created_at)} · 状态 {translateTaskStatus(pipeline.latest.status)}
                  </p>
                )}
              </div>
            ))}
            {!taskPipelines.length && <p className="text-sm text-slate-400">暂无任务数据，可先在上传页触发。</p>}
          </div>
          {!!recentFailures.length && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-white">最近失败任务</p>
              <div className="mt-3 space-y-2 text-xs text-slate-400">
                {recentFailures.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-rose-400/40 bg-rose-950/30 px-3 py-2">
                    <p className="text-white">{translateTaskType(task.task_type)}</p>
                    <p className="text-rose-200">{sanitizeOpsText(task.last_error ?? task.error ?? '未知错误')}</p>
                    <Link href={`/tasks?highlight=${task.id}`} className="text-cyan-300 hover:underline">
                      跳转任务 #{task.id.slice(0, 6)}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="surface-card p-6">
          <h2 className="text-xl font-semibold text-white">LLM SLA 追踪</h2>
          <p className="text-sm text-slate-400">展示核心 Agent（风险识别、条款改写等）的响应概览。</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="surface-panel p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">成功率</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {sla?.successRate != null ? `${Math.round(sla.successRate * 100)}%` : '—'}
              </p>
              <p className="text-xs text-slate-400">近 {sla?.windowHours ?? 24} 小时任务成功率，基于 task_attempts</p>
            </div>
            <div className="surface-panel p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">平均时长</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatSeconds(sla?.averageCompletionSeconds)}</p>
              <p className="text-xs text-slate-400">完成任务平均耗时；队列中：{insights?.totals.openTasks ?? 0}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
