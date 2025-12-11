# 开发指南：Still Legal AI 合同审查 SaaS 平台

> 版本：2025-12-02 | 包含最新调试经验、认证修复和 Claude Flow 集成最佳实践

## 1. 产品定位
- **目标用户**：企业法务、合规、业务协合同团队
- **核心功能**：合同上传 → OCR/解析 → 风险识别 → 智能建议 → 关键条款提取 → 合规通知 → 洞察报告，全流程自动化
- **愿景**：降低合同风险、提升 LLM/OCR 识别准确率、Agent 协作效率、人工审核效率

## 2. 技术架构
```
Next.js 16 (App Router)
 ├─ API Routes (/api/*) + Supabase REST + Edge Functions
└─ Supabase
   ├─ Postgres 15 + pgvector
   ├─ Storage (contracts bucket)
   ├─ Auth / RLS / 多租户字段
   └─ Edge Functions（ingest-doc、task-runner、risk-analyzer、key-clause-extractor、regulation-sync、notification-dispatcher、insight-reporter）
└─ 外部服务：DeepSeek OCR/阿里云 OCR + OpenAI/DeepSeek/Azure 等 LLM
```

## 3. 开发栈
- **前端**：React 19 + Next.js 16（Server Actions、App Router、TailwindCSS）
- **后端**：Supabase（Auth/RLS、Postgres、Storage、pgvector）+ Edge Functions（Deno+TS）
- **工具链**：ESLint、Vitest、GitHub Actions、Claude Flow、Upstash/QStash（可选调度）

## 4. 业务模块
1. **合同导入**：上传 → Storage → `ingest-doc` → 创建 `contracts`/`contract_versions`/`tasks`
2. **OCR + 解析**：`task-runner` 处理原文 → OCR → LLM 解析 → 写入 `clauses` → 自动建议 + 关键词提取
3. **风险识别**：`risk-analyzer` 使用法学 LLM 生成 JSON → 写入 `risk_findings` → 生成通知
4. **法规同步**：`regulation-sync` 抓取法规 + 嵌入 → 向 `/regulations` 页面推送
5. **关键条款提取**：`key-clause-extractor` 强化检索 `clause_id` → 写入 `key_clauses` → 关键条款图配原文 → 在线合同编辑增强
6. **审批/流程**：`tasks` + `task_attempts` 记录轨迹、失败重试 → 值写入 `approvals`、`notifications` → webhooks
7. **仪表板/洞察**：`/dashboard` 综合指标、SLA → `insight-reporter` 生成 Markdown/PDF 报告

## 5. 数据模型摘要
- **核心业务**：`contracts` → `contract_versions` → `clauses` → `risk_findings` → `key_clauses`
- **法规库**：`regulations` → `regulation_sections`
- **任务流**：`tasks` → `task_attempts` → `approvals` → `notifications`
- **多租户**：所有表均带 RLS + JWT + `tenant_id` 字段匹配

## 6. 关键流程
### 上传 & 导入
1. `/upload` → `/api/upload` → 获取签名 URL → 上传至 Storage → metadata 带 `tenant_id` 标记
2. `/api/ingest` → 调用 `ingest-doc` → 创建合同/版本/任务，并返回 `task_id`
3. Scheduler/QStash 触发 `task-runner` → OCR+解析 → 写入 `clauses` → 触发团队协作/关键词提取

### 风险识别
- `risk-analyzer` 调用法学 LLM → 生成 `risk_findings` → 写入 `notifications` → Dashboard/告警使用
- **支持中英文风险级别**：`'high'`、`'High'`、`'高'` 统一识别为高风险

### 关键条款
- `key-clause-extractor` 用于检索增强 LLM → 生成带 `clause_id` 的 `clause_no` → 若无法匹配则记录 warning
- 关键条款图配原文 → 在线图 → 在线编辑接口，支持人工修订和合同版本管理

### 通知/审批
- `notifications` 记录 severity、metadata、delivered_at → `notification-dispatcher` 触发 webhook
- 失败写入 `approvals` → 前往 `/tasks` → 提醒团队或人工备注

### Dashboard / Reports
- `/api/insights` 综合合同/风险/任务/SLA 数据 → 风险优先级（High/high/高）统一归一
- Dashboard 全局告警通知 → 自动解析任务错误 → 例如 `task:xxx ingestion failed` → 通知团队 "xxx 合同解析失败"
- `/api/reports/export` → 调用 `insight-reporter` → 生成专业法律合规报告

## 7. 环境变量
`.env.local` 示例配置：
```
NEXT_PUBLIC_SUPABASE_URL=https://crndpzhpvhcncoscoiba.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_m6prWpwKL3UXy6osD8Y7cg_FBA7Zm-l
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CONTRACTS_BUCKET=contracts
KEY_CLAUSE_EXTRACTOR_TOKEN=key_clause_secret_af31b7c2
INSIGHT_REPORTER_TOKEN=insight_reporter_secret_af31b7c2
```

Edge Function Secrets 需要设置：`PROJECT_SUPABASE_URL`、`PROJECT_SERVICE_ROLE_KEY`、`KEY_CLAUSE_EXTRACTOR_TOKEN`，task-runner、key-clause-extractor 需保持一致，外加 `LLM_BASE_URL/KEY`、`OCR_BASE_URL/KEY` 等。

## 8. 故障排查与维护
- **查看日志**：Supabase Console → Edge Functions Logs，必要时 `functions deploy`
- **任务重试**：SQL 直接 `update tasks set status='queued', retry_count=coalesce(retry_count,0) where id='...'`
- **手动触发**：
  ```bash
  curl https://<proj>.supabase.co/functions/v1/task-runner \
    -H "Authorization: Bearer <SERVICE_ROLE>" \
    -H "Content-Type: application/json" -d '{}'
  ```
- **关键条款提取**：使用最新的 token 同步 `task-runner` 和 `key-clause-extractor`，参考 `curl .../key-clause-extractor` 即可

### 常见问题解决
- **RLS 数据访问问题**：使用 Service Role 客户端绕过 RLS 限制进行调试
- **报告数据为空**：检查风险查询是否使用正确的客户端，确保多表 JOIN 查询正确执行
- **风险级别识别**：确保同时支持英文（'high', 'High'）和中文（'高'）风险级别
- **Magic Link 认证失败**：环境变量中的换行符会导致认证失败，需要使用 `.trim().replace(/[\n\r]/g, '')` 清理
- **Cookie 配置问题**：统一使用 `sameSite: 'lax'` 配置，避免跨域 Cookie 问题

## 9. Claude Flow 集成
### 日常使用流程
```bash
# 每日开始工作时
./start-work.bat daily

# 遇到问题时存储上下文
claude-flow memory store "当前问题" "详细描述问题..." --reasoningbank

# 修复后记录解决方案
claude-flow memory store "问题解决" "解决方案和验证结果..." --reasoningbank

# 搜索类似问题
claude-flow memory query "关键词" --reasoningbank
```

### 最佳实践
- **项目初始化**：记录项目架构、技术栈、核心模块
- **问题解决**：记录问题描述、分析过程、解决方案、验证结果
- **知识积累**：建立项目专属的技术知识库，避免重复踩坑
- **定期回顾**：搜索历史记忆，快速检索解决方案

## 10. 性能优化建议
- 数据库外键索引优化（已识别缺少15个索引）
- OCR 并行化处理
- LLM 调用缓存机制
- Agent 协作优化
- 实时反馈用户体验提升

## 11. TODO / 规划
- 自动化报告导出工具：Dashboard 实时数据图表、风险趋势可视化、Report PDF 导出、关键条款
- Claude Flow 深度集成：智能调试助手、问题自动诊断、解决方案推荐
- 性能监控：SLA 追踪、错误率分析、系统健康度监控

---

**重要说明**：本指南基于实际开发经验编写，包含了最新的调试发现和 Claude Flow 使用最佳实践。修改 Agent 或 Edge Function 时，请先合并到本指南，更新对应章节，确保文档与实际代码保持同步。