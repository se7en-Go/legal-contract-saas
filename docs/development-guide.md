# 开发指南（Still Legal AI 合同审查 SaaS）

## 1. 产品定位与目标
- 面向法务、风控、业务协同团队，提供合同上传、自动拆条、风险比对、法规引用、关键条款沉淀、审批流以及洞察报告。
- 重点场景：批量合同审查、跨团队协同、风险复核、客户交付。
- 强调多租户隔离、可插拔 LLM/OCR 服务，并支持可追踪的 Agent 工作流。

## 2. 系统架构
```
Next.js (App Router)
   └─ API Routes（/api/*） → Supabase REST / Edge Functions
Supabase
   ├─ Postgres + pgvector
   ├─ Storage (contracts bucket)
   ├─ Auth / RLS
   └─ Edge Functions（ingest-doc、task-runner、risk-analyzer、key-clause-extractor、
                      regulation-sync、notification-dispatcher、insight-reporter）
外部服务
   ├─ OCR（DeepSeek / 自选 Provider）
   └─ LLM（可对接 OpenAI、DeepSeek、Azure 等）
```
- 所有前后端请求均使用 Supabase Auth JWT 鉴权，API Route 内部根据 `tenant_id` 限定数据范围。
- Edge Functions 承担异步任务（OCR、解析、法规同步、通知派发、报告生成等）。

## 3. 技术栈
- 前端：React 19 + Next.js 16（App Router、Server Actions）、Tailwind CSS。
- 后端/数据库：Supabase（Postgres 15 + pgvector + Storage）。
- Edge Functions：Deno + TypeScript。
- 工具：ESLint、GitHub Actions（可手动触发 Edge Functions）、Upstash/QStash（可选）。

## 4. 核心模块
1. **合同接入**：上传文件 → Storage → `ingest-doc` → 创建 `contracts`/`contract_versions` → `tasks`。
2. **OCR + 拆条**：`task-runner` 下载原文 → OCR → LLM 抽条 → 写入 `clauses`。
3. **风险识别**：`risk-analyzer` 基于条款调用 LLM，写入 `risk_findings`，同时触发通知。
4. **法规管理**：`regulation-sync` 同步外部法规/章节；前端 `regulations` 页面浏览、搜索。
5. **关键条款提取**：`key-clause-extractor` 聚合 LLM 输出写入 `key_clauses`。
6. **任务队列与审批**：`tasks` 记录状态、重试、`task_attempts` 追踪；失败任务写入 `approvals`，并通过 `notifications` 推送到 webhook。
7. **通知 / 审批流**：`notification-dispatcher` 读取 `notifications` 向租户 webhook 发送；前端 `/api/notifications` 可查询/标记；`/api/approvals` 支持审批操作。
8. **洞察报告**：前端 `/reports` 调 `/api/reports/export`，由 `insight-reporter` 生成 Markdown/PDF（目前为 Markdown 预览）。

## 5. 数据模型（关键表）
- `contracts`、`contract_versions`、`clauses`、`risk_findings`、`key_clauses`
- `regulations`、`regulation_sections`
- `tasks`、`task_attempts`、`approvals`
- `notifications`（新增 `severity`、`metadata`、`delivered_at`）
- 其他：`tenants`、`tenant_users`、`audit_logs`、`annotations`
- 所有多租户表均启用 RLS，`tenant_id` 必须与 Auth JWT 中一致。

## 6. 主要流程
### 6.1 上传 & 解析
1. 前端 `/upload` 调 `/api/upload`（服务角色+Metadata），返回 Storage path。
2. `/api/ingest` 调 `ingest-doc` Edge Function → 写 `contracts`、`contract_versions`、`tasks`。
3. QStash/定时器触发 `task-runner` → OCR → LLM 拆条 → `clauses` → 调 `risk-analyzer`、`key-clause-extractor`。

### 6.2 风险识别
1. `risk-analyzer` 拉取 `clauses` → 调 LLM JSON 输出 → 写 `risk_findings`。
2. 写成功后向 `notifications` 插入一条记录，`notification-dispatcher` 负责推送。

### 6.3 法规/关键条款
1. `regulation-sync` 定期读取外部 feed（或 fallback 示例），Upsert `regulations`/`regulation_sections`。
2. `key-clause-extractor` 接受任务后聚合 LLM 输出写入 `key_clauses`。
3. 前端 `regulations`、`clauses` 页面通过 `/api/regulations`、`/api/key-clauses` 展示。

### 6.4 通知 & 审批
1. `notifications` 表记录所有系统事件，支持 severity、metadata。
2. `notification-dispatcher` 调租户 `outgoing_webhooks`。
3. 任务失败超过重试阈值写入 `approvals`，前端 `/api/approvals` 可查看/处理。

### 6.5 洞察报告
1. `/reports` 页面调用 `/api/reports/export`，聚合合同/风险/任务统计。
2. Edge Function `insight-reporter` 生成 Markdown 报告，前端可预览。

## 7. 环境与配置
- `.env.local`（前端）：
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  CONTRACTS_BUCKET=contracts
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  INSIGHT_REPORTER_TOKEN=...
  KEY_CLAUSE_EXTRACTOR_TOKEN=...
  REGULATION_SYNC_TOKEN=...
  NOTIFICATION_DISPATCH_TOKEN=...
  ```
- Supabase Edge Function Secrets（控制台设置）：
  - `TASK_RUNNER_SERVICE_TOKEN`
  - `KEY_CLAUSE_EXTRACTOR_TOKEN`
  - `REGULATION_SYNC_TOKEN`
  - `NOTIFICATION_DISPATCH_TOKEN`
  - `INSIGHT_REPORTER_TOKEN`
  - `TASK_MAX_ATTEMPTS`
  - `PROJECT_SUPABASE_URL` / `PROJECT_SERVICE_ROLE_KEY`
  - `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL_ID`
  - `OCR_BASE_URL` / `OCR_API_KEY` / `OCR_MODEL_ID`

## 8. 本地开发
1. `npm install`（根目录、`web/` 如有需要）。
2. `cd web && npm run dev`，默认监听 `http://localhost:3000`。
3. Supabase Auth：在 Dashboard 的 `Authentication -> URL Configuration` 中，将 `Site URL` 与 `Redirect URLs` 设置为 `http://localhost:3000` 与 `http://localhost:3000/auth/callback`。
4. 登录流程：`/login` → Magic Link → `/auth/callback`；若 Supabase 返回 `#access_token`，前端 `AuthHashHandler` 会自动解析。

## 9. CI/CD & 任务运行
- GitHub Actions 可部署/触发 Edge Functions（Invoke Task Runner workflow 如不需要可禁用）。
- 任务调度：可用 Supabase Scheduler、Upstash QStash 或 GitHub Action 定期调用 `task-runner`、`notification-dispatcher`、`regulation-sync`。

## 10. TODO & 扩展建议
- 关键条款/法规 UI 已实现基本展示，可继续丰富筛选、批注。
- 审批流可扩展多级流程、附件上传等。
- 报告导出当前为 Markdown，可接入 PDF 服务（如 Puppeteer、Vercel OG）。
- 提供更多 Agent 可视化监控、任务依赖图。

---
如需新增功能或部署帮助，请同步更新本指南，保持流程/环境一致性。*** End Patch
