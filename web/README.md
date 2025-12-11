# Still Legal AI Web

Next.js 16 (App Router) 前端，承载 SaaS 合同审查控制台及 API routes。依赖 Supabase Auth、Edge Functions 以及多租户配置。

## 主要功能
- 上传合同：调用 `/api/upload`、`/api/ingest`，展示任务进度。
- 条款/风险/通知：读取 Postgres (`clauses`, `risk_findings`, `notifications`) 并结合 Auth JWT 过滤 `tenant_id`。
- 洞察报告：触发 `insight-reporter` Edge Function，预览 Markdown。
- 管理面板：任务重跑、风险复审、Webhook 状态等。

## 快速开始
```bash
npm install           # 根目录安装依赖
cd web && npm run dev # 启动前端 (http://localhost:3000)
```
> 首次运行前，请先启动 Supabase 本地服务或连接远程项目，保证 `.env.local` 中的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 生效。

## 环境变量
`web/.env.local` 示例：
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CONTRACTS_BUCKET=contracts
NEXT_PUBLIC_SITE_URL=http://localhost:3000
INSIGHT_REPORTER_TOKEN=...
KEY_CLAUSE_EXTRACTOR_TOKEN=...
REGULATION_SYNC_TOKEN=...
NOTIFICATION_DISPATCH_TOKEN=...
```
- `NEXT_PUBLIC_*` 变量会注入浏览器，必须使用可公开的 key。
- `SUPABASE_SERVICE_ROLE_KEY` 仅在 Server Actions / API Route 中使用，请勿暴露至客户端。
- `KEY_CLAUSE_EXTRACTOR_TOKEN` 等 Edge token 需要与 Supabase 控制台 Secrets 保持一致。

## 常用脚本
| 命令 | 说明 |
| --- | --- |
| `npm run lint` | 执行 ESLint，确保 CI 通过 |
| `npm run dev` | Dev server (watch mode) |
| `npm run build && npm run start` | 生产构建与本地预览 |

## 调试提示
1. **登录**：`/login` 使用 Supabase Magic Link，确保 Supabase Dashboard -> Authentication -> URL 配置与 `NEXT_PUBLIC_SITE_URL` 一致。
2. **任务/Agent**：可在 `/tasks` 页面查看状态，必要时通过 SQL Editor 重置 `tasks.status = 'queued'` 并调用 `task-runner`。
3. **关键条款**：`/clauses` 页面依赖 `key_clauses` 表，如遇“暂无数据”，检查 `key-clause-extractor` 是否返回 401；需同时携带 Service Role JWT (`Authorization/apikey`) 与 `x-agent-token`。
4. **日志**：Supabase Dashboard -> Edge Functions -> Invocations 可查看 request/response，有助排查 token/headers。

## 部署
- 推荐使用 `supabase functions deploy <name>` 将 Edge Functions 推送到远程项目。
- Next.js 前端可部署到 Vercel / 自建环境，记得同步 `.env`、Supabase URL/KEY，以及各 Edge token。
- CI 建议在合并前运行 `npm run lint`、`npm run build`，并由 GitHub Actions 触发必要的 Edge Functions。

更多信息参考 `docs/development-guide.md` 与 `docs/upload-ingest-workflow.md`。
