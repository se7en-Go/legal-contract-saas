# 开发指南（Legal AI 合同审查 SaaS）

## 1. 产品定位与目标
- 面向律所与法务团队，自动识别合同风险条款、不合规内容，并给出基于最新法规的修改建议。
- 支持合同版本比对、关键条款提取、归档及协同审阅。
- 后端以 Supabase 为核心，调用自建 LLM（自定义 base URL/API Key/Model Id）。

## 2. 总体架构
```
Client (Next.js / Nuxt) ─? API SDK ─? Supabase Edge Functions
                                   │
                                   ├─? Supabase Postgres + Storage + Auth + Realtime
                                   ├─? pgvector 检索（合同条款、法规向量）
                                   ├─? Object Storage (PDF/Word/OCR)
                                   ├─? 队列 (Supabase Scheduler + Upstash/QStash) 用于长耗时任务
                                   └─? 自建 LLM Service (Base URL / API Key / Model ID)
```
- 所有调用通过 Supabase JWT 鉴权，Edge Functions 负责组合业务逻辑、任务编排。
- 文档解析/OCR 可部署独立解析服务（Docling/Document AI）并通过 Webhook 与 Edge Functions 通信。

## 3. 技术栈
- 前端：React + Next.js 14 (App Router, Server Actions) 或 Vue + Nuxt 3（SSR）。
- 后端：Supabase (Postgres 15 + pgvector) + Edge Functions (TypeScript / Deno)。
- LLM：自建推理服务，统一封装 SDK，支持同步/流式响应、重试、审计日志。
- 文档处理：LangChain、Docling、pdfminer、Azure Form Recognizer（可选）。
- 流程工具：Upstash/QStash、Supabase Scheduler、Supabase Realtime。
- 监控：Supabase Logs、Logflare、Sentry/Highlight、Prometheus/Grafana (自建服务)。

## 4. 模块划分
1. **合同管理**：上传、OCR、结构化解析、版本管理。
2. **风险识别引擎**：条款级风险检测、风险等级、整改建议。
3. **法规对照**：法规库管理、法规更新任务、条款-法规引用。
4. **关键条款提取**：自动提取付款、违约、保密等关键条款并归档。
5. **版本比对**：语义 + 文本 diff，风险变化追踪。
6. **协作与审计**：评论、指派、通知、操作日志。
7. **系统管理**：租户、角色、权限、计划/计费（后续）。

## 5. 数据库设计（Supabase Postgres）
- `tenants (id, name, plan, settings, created_at)`
- `users (id, email, profile, created_at)`
- `tenant_users (tenant_id, user_id, role, status)`
- `contracts (id, tenant_id, title, counterparty, status, storage_path, checksum, metadata, created_by, created_at)`
- `contract_versions (id, contract_id, version_no, source_path, parsed_json, summary, created_at)`
- `clauses (id, contract_version_id, clause_no, title, body, clause_type, embedding, risk_score)`
- `risk_findings (id, clause_id, risk_level, risk_type, description, recommendation, regulation_refs, llm_trace_id)`
- `regulations (id, name, jurisdiction, effective_date, expiry_date, source_url)`
- `regulation_sections (id, regulation_id, section_no, text, embedding, tags)`
- `tasks (id, tenant_id, task_type, payload, status, progress, error, created_at)`
- `notifications (id, tenant_id, entity, message, read_at)`
- `audit_logs (id, tenant_id, actor_id, action, payload, created_at)`
- `annotations/comments (id, contract_version_id, clause_id, content, created_by, created_at)`
- 所有表启用 Row Level Security，policy 以 `tenant_id` 过滤。

## 6. 核心流程
### 6.1 合同上传 & 解析
1. 客户端上传文件 → Supabase Storage（使用签名 URL）。
2. 触发 Edge Function：创建 `task` 记录，调用解析服务。
3. 解析输出：原文、结构化 JSON、页面坐标、embedding → 写入 `contract_versions` / `clauses` 表。
4. 将条款 embedding 写入 pgvector，用于后续检索。

### 6.2 风险识别 & 法规对照
1. 根据 `clauses` embeddings + 规则库检索上下文（Top-k）。
2. 构建 prompt：系统角色=法律专家，输入条款文本 + 合同元数据 + 匹配法规摘要。
3. 调用自建 LLM，得到 JSON：`[{clause_no, risk_level, finding, recommendation, regulation_refs}]`。
4. Edge Function 校验 JSON schema，写入 `risk_findings`，同时记录 LLM trace。
5. 对照最新法规：向量检索 + 版本检查，若法规已更新则触发重新审查任务。

### 6.3 修改建议与版本比对
- LLM 生成修改后的条款文本，存入 `clause_rewrites` 表供审阅。
- 使用 diff-match-patch 或 jsdiff 生成版本差异，附带风险变化指标。

### 6.4 关键条款提取
- 在解析阶段增加一个 LLM 任务，输出关键条款列表（类别、责任主体、金额/日期等），写入 `key_clauses`。
- 提供按类别、客户、合同类型的检索接口。

## 7. LLM 集成设计
- SDK 负责：鉴权、超时、重试、限流、流式（Server-Sent Events）。
- Prompt 模板存储在 `prompts` 目录并版本化，包含：
  - `risk_detection.prompt`
  - `regulation_alignment.prompt`
  - `clause_rewrite.prompt`
  - `summary_generation.prompt`
- 返回结果统一 JSON Schema（使用 zod/superstruct 校验）。
- 记录 `llm_requests` 表：prompt, variables, settings, latency, response hash。

## 8. 安全与合规
- 强制 HTTPS、JWT + RLS。
- Storage 根据租户隔离路径 `/tenant_id/contracts/...`。
- 合同与法规文本使用列级别加密（pgcrypto）或外部 KMS。
- 所有导出操作需要审计日志记录。
- 定期法律法规更新；提供管理员审批流程。

## 9. 部署与环境
- **环境**：dev / staging / prod（独立 Supabase 项目）。
- **CI/CD**：GitHub Actions
  - 前端测试与构建 → Vercel/Netlify。
  - Supabase migrations & Edge Functions 自动部署。
  - Lint/Test：ESLint, Vitest/Jest, Playwright。
- **配置管理**：`.env.local`（前端）和 Supabase config；Secrets 包括 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_ID`。

## 10. 迭代路线
1. **MVP**
   - 合同上传 + 解析（仅 PDF 文本）
   - 基础风险检测（固定 prompt + pgvector 检索）
   - 风险列表 + 报告导出
2. **v1**
   - 版本比对、关键条款库、法规数据库
   - OCR、长文档 chunking、LLM 结果可编辑
   - 通知与审批流
3. **v2**
   - 自动化工作流、模板生成、第三方 API
   - 审计报表、计费/套餐、客户门户

## 11. 开发节奏建议
- 每个模块以 feature flag 控制上线。
- 对高价值 LLM 任务（如风险识别）做好缓存与回放测试。
- 对法规更新、LLM Prompt 变动设置审批与 A/B 实验。
