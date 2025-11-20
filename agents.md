# Agents

| Agent | 目标 | 输入 | 输出 | 技术栈/实现要点 |
| --- | --- | --- | --- | --- |
| Ingestion Agent | 处理合同上传、OCR、解析、分块与向量化 | 原始 PDF/Word、元数据（租户、合同类型） | 结构化 JSON（章节/条款）、纯文本、embedding、解析日志 | Docling / Azure Form Recognizer；LangChain 文档加载；写入 Supabase Storage + Postgres + pgvector |
| Risk Analyzer Agent | 识别风险条款、级别、原因、整改建议 | `clauses` 表内容、合同上下文、法规检索结果 | 风险列表（JSON），`risk_findings` 记录 | 自建 LLM（法律专业模型）、prompt 模板、JSON schema 校验、置信度阈值、缓存 |
| Regulation Retrieval Agent | 构建法规索引、检索最新条文 | 法规爬虫数据、pgvector 检索请求 | 匹配法规章节、法条摘要、版本信息 | 定时抓取（Scheduler）、人工审批；文本嵌入向量检索；法规版本化存储 |
| Clause Rewrite Agent | 给出条款修改建议与标注 | 风险条款文本、法规引用、组织偏好模板 | 重写建议、差异标注、评分 | Prompt 模板 + 温度控制；输出 Markdown/JSON；记录建议追踪 ID |
| Version Diff Agent | 对比多个合同版本，输出差异与风险变化 | `contract_versions` 内容、条款主键映射 | 条款级 diff、语义差异、风险变化摘要 | diff-match-patch + embedding similarity；生成前端 diff 数据结构 |
| Key Clause Extraction Agent | 自动提取和归档关键条款 | 合同结构、行业字典 | 关键条款列表（类别、责任主体、金额、日期） | LLM + few-shot prompting；数据写入 `key_clauses`；与搜索 API 联动 |
| Workflow Orchestrator | 编排长耗时任务、监控状态、触发通知 | 任务定义、触发器（上传、法规更新、人工复审） | 任务状态、回调、通知事件 | Edge Functions + Task 表；Upstash/QStash 队列；Webhook 回调 |
| Insight Reporter | 生成报告、仪表盘摘要、导出文档 | 风险结果、版本 diff、关键条款 | 报告（PDF/HTML）、仪表盘数据、订阅邮件 | Next.js API Routes/Edge Function；LLM summary；模板引擎 (Handlebars) |

## Agent 协作流程
1. Ingestion Agent 完成解析后，将结果和任务状态写入 `contract_versions` 和 `tasks`。
2. Workflow Orchestrator 根据任务类型触发 Risk Analyzer、Key Clause Extraction、Regulation Retrieval。
3. Risk Analyzer 需要 Regulation Retrieval 提供的最新法规上下文；完成后写入 `risk_findings` 并通知 Clause Rewrite。
4. Clause Rewrite Agent 根据用户偏好生成建议，交给 Insight Reporter 形成审查报告。
5. Version Diff Agent 在每次新版本创建时运行，更新 diff 数据、风险变化趋势。
6. Insight Reporter 汇总所有输出，推送到前端 / 邮件 / 导出。

## 实施建议
- 所有 Agent 通过 Edge Functions 暴露 HTTP 接口，内部以消息队列或 `tasks` 表驱动。
- 记录 agent 运行日志、输入/输出哈希，便于审计与回放。
- Agent 之间的依赖通过任务状态管理，避免重复执行。
- 对关键 Agent（Risk Analyzer、Clause Rewrite）支持手动复审和重跑。
