# 上传 & 导入工作流程

> 版本：2025-12-02 | 包含最新调试经验和最佳实践

## 1. 准备多租户
```bash
node scripts/seed-tenant.js "租户名称"
```
脚本会在 `tenants`/`tenant_users` 表写入记录并返回 `tenant_id`。上传时 Edge Functions 调用必须携带该值。

## 2. 上传合同文件
1. 调用 `/api/upload` 获取 Storage 签名 URL：
   ```typescript
   const { data } = await client.storage.from('contracts').createSignedUploadUrl(
     `tenant/${tenantId}/${file.name}`,
     60,
     { upsert: true, contentType: file.type, metadata: { tenant_id: tenantId } }
   );
   ```
2. 使用 `multipart/form-data` 上传至 `data.signedUrl`
3. 记录返回的 `storage_path`，格式为 `tenant/<tenant_id>/contract.pdf`
   > CLI 上传示例：`npx supabase storage cp local.pdf contracts/tenant/<tenant_id>/contract.pdf`，但必须手动写入 metadata 的 `tenant_id`

## 3. 调用 `ingest-doc`
```bash
curl -X POST https://crndpzhpvhcncoscoiba.supabase.co/functions/v1/ingest-doc \
  -H "Authorization: Bearer <SERVICE_ROLE|用户 JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant_id>",
    "title": "合同名称",
    "counterparty": "对方公司",
    "storage_path": "tenant/<tenant_id>/contract.pdf"
  }'
```
返回 `contract_id`、`contract_version_id`、`task_id`，`tasks.payload` 会存储版本 ID，供后续 Agent 使用。

## 4. task-runner 执行 OCR + 解析
- 查询 `tasks.status = 'queued'` 的任务：
  1. `.docx` 直接解析 `word/document.xml`
  2. PDF/图片 转 Base64 分片调用 OCR（默认 DeepSeek OCR）
  3. 调用 LLM 解析条款列表 → 写入 `clauses`
  4. 记录 `task_attempts` → 触发 Risk Analyzer / Key Clause Extractor
- **关键更新**：内部查询使用 `PROJECT_SERVICE_ROLE_KEY`，避免 RLS 限制

## 5. 风险识别
`task-runner` 完成后自动触发 `risk-analyzer`，需要手动触发时：
```bash
curl -X POST https://crndpzhpvhcncoscoiba.supabase.co/functions/v1/risk-analyzer \
  -H "Authorization: Bearer <SERVICE_ROLE>" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"<tenant_id>","contract_version_id":"<version_id>"}'
```
写入 `risk_findings` 表，在 `/risks` 和 `/dashboard` 展示风险统计和通知。

### 风险级别支持
- **英文**：`'high'`、`'High'`、`'medium'`、`'Medium'`、`'low'`、`'Low'`
- **中文**：`'高'`、`'中'`、`'低'`
- **统一处理**：API 会将 `'high'`、`'High'`、`'高'` 都识别为高风险

## 6. 关键条款提取
- 默认由 `task-runner` 触发 `key-clause-extractor`：
  ```bash
  curl -X POST https://crndpzhpvhcncoscoiba.supabase.co/functions/v1/key-clause-extractor \
    -H "Authorization: Bearer <SERVICE_ROLE>" \
    -H "apikey: <SERVICE_ROLE>" \
    -H "x-agent-token: <KEY_CLAUSE_EXTRACTOR_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"tenant_id":"<tenant_id>","contract_version_id":"<version_id>"}'
  ```
- 基于 LLM 生成带 `clause_id` 的 `clause_no`，匹配失败时记录 warning
- 关键条款图配原文 → 在线图 → 在线编辑接口，支持人工修订和合同版本管理

## 7. Task 重试 / 调试
- SQL 直接重试锁定任务：
  ```sql
  update tasks
     set status = 'queued', retry_count = coalesce(retry_count, 0), updated_at = now()
   where id = '<task_id>';
  ```
- 手动触发 task-runner：
  ```bash
  curl -X POST https://crndpzhpvhcncoscoiba.supabase.co/functions/v1/task-runner \
    -H "Authorization: Bearer <SERVICE_ROLE>" \
    -H "Content-Type: application/json" \
    -d '{}'
  ```
- 查看 Edge Logs：Supabase Dashboard → Edge Functions → Logs

## 8. 常见问题与解决方案
| 问题 | 排查建议 |
| --- | --- |
| Storage 403 | 检查上传 JWT 的 `tenant_id` 与 metadata 是否一致，`storage.objects` 表 `metadata->>'tenant_id'` 是否匹配 |
| `ingest-doc` 失败 | 查看 Edge Logs，确认 `storage_path` 和 `tenant_id`，Service Role key 是否正确 |
| risk/clauses JSON 格式错误 | `task-runner`/`risk-analyzer` 查看 Logs，打印原始 LLM 响应，检查 ```json``` 包裹是否合法 |
| Dashboard 风险统计不一致 | `/api/insights` 检查风险级别统一（high/high/高风险），确认 `risk_findings` 是否正确写入 risk_level |
| 关键条款"未找到"或"未处理" | 关键条款图只显示 `clauses.title`，检查原文与关键条款图匹配，可尝试"重新分析"该 `clauses` |

### 最新调试经验
- **报告数据为空问题**：确保风险查询使用 Service Role 客户端，避免 RLS 限制
- **变量重复定义错误**：检查 API 代码中是否有重复的变量声明
- **风险统计不准确**：确保风险级别过滤逻辑支持中英文格式

## 9. OCR 配置（Secrets）
```
OCR_BASE_URL=https://api.siliconflow.cn
OCR_API_KEY=<DeepSeek OCR KEY>
OCR_MODEL_ID=deepseek-ai/DeepSeek-OCR
```
`task-runner` 获取 Secrets → 文件分片转 Base64 → OCR → 结构化文本 → LLM 解析

## 10. 报告生成
```bash
# 生成合同风险报告
curl -X POST http://localhost:3001/api/reports/export \
  -H "Content-Type: application/json" \
  -H "Cookie: supabase.auth.token=<valid_auth_token>" \
  -d '{
    "dateRange": "30d",
    "contractType": "all",
    "contractId": null
  }'
```
返回 Markdown 格式的专业法律合规报告，包含：
- 合同统计数据
- 风险分析（支持中英文风险级别）
- 高风险项详情
- 合规建议

## 11. Claude Flow 调试辅助
使用 Claude Flow 记录和解决上传导入问题：
```bash
# 记录问题
claude-flow memory store "上传失败" "Storage返回403，检查metadata和tenant_id匹配" --reasoningbank

# 记录解决方案
claude-flow memory store "403解决" "确保上传时metadata包含正确的tenant_id" --reasoningbank

# 搜索类似问题
claude-flow memory query "Storage 403" --reasoningbank
```

---

**说明**：本文档基于最新的生产环境经验编写，包含了实际调试中发现的问题和解决方案。使用 Claude Flow 可以有效积累调试经验，建立项目专属知识库。