# Agents 总览

| Agent | 目标 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- | --- |
| Ingestion Agent | 上传合同、OCR、拆条与向量化 | 合同文件 + 元数据（租户、合同类型） | `contracts`、`contract_versions`、`clauses`、解析日志 | Storage 签名上传；`ingest-doc` Edge Function 创建任务 |
| Task Runner | OCR + LLM 拆条、触发后续 Agent | `tasks.status=queued` 任务 | 条款拆分 + 触发 risk-analyzer / key-clause-extractor | 下载 Storage 文件 → OCR → LLM → 写入 `clauses` |
| Risk Analyzer | 识别风险条款、风险级别与建议 | `clauses`、法规检索上下文 | `risk_findings`、通知 | 自建法律 LLM，输出 JSON，落库后推送通知 |
| Key Clause Extractor | 提取关键条款，写入结构化属性 | `clauses`（含条号/标题）、可选分类 | `key_clauses`（含 `clause_id`） | LLM few-shot，现已要求输出 `clause_id`；缺失条号时可匹配 `clause_no` |
| Regulation Sync | 构建法规索引 / 抓取最新条文 | 法规源数据、pgvector | `regulations`、`regulation_sections` | 定时 job + 人工审批，生成嵌入向量供检索 |
| Clause Rewrite Agent | 给出条款修改建议与标注 | 风险条款文本、法规引用、组织偏好 | Markdown/JSON 建议 + 追踪 ID | Prompt 模板 + 温控；可人工复审 |
| Version Diff Agent | 比较合同版本差异 | `contract_versions`、条款映射 | 条款 diff、风险变化摘要 | diff-match-patch + embedding similarity |
| Workflow Orchestrator | 调度长耗时任务、监控通知 | `tasks`、`task_attempts`、`notifications` | 任务状态、Webhook、审批记录 | `task-runner` + Upstash/QStash（可选）;
 失败任务写入 `approvals` |
| Insight Reporter | 生成报告/仪表盘摘要 | 风险、条款、版本、任务统计 | 报告（Markdown/PDF）、仪表盘数据、订阅邮件 | Next.js API Routes/Edge Function；Handlebars 模板 |

## 协作流程简述
1. **上传**：`ingest-doc` 将合同写入 `contracts`/`contract_versions` 并创建任务。
2. **拆条**：`task-runner` OCR + LLM 拆条 → 写 `clauses` → 调用 Risk Analyzer、Key Clause Extractor。
3. **风险**：`risk-analyzer` 写 `risk_findings`，并在 `notifications` 中生成事件。
4. **关键条款**：新版函数会携带 `clause_id`，关键视图和原始条款可同步编辑标题。
5. **通知/审批**：`notifications` 提供 webhook；失败任务写入 `approvals` 可人工处理。
6. **仪表盘/报告**：`/dashboard`、`/reports` 聚合上述数据，提供 SLA 与导出。

> 所有 Edge Functions 使用 Service Role JWT +（可选）`x-agent-token` 校验。敏感函数（如 Key Clause Extraction）必须同时携带三种 Header：`Authorization`、`apikey`、`x-agent-token`。
