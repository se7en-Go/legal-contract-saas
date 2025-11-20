# 上传与入库流程

## 1. 准备租户 ID
运行 `node scripts/seed-tenant.js "你的租户名称"`，脚本会在 `tenants` 表创建或返回现有租户，并打印 `tenant_id`。后续上传、函数调用都需要这个 ID，并需要在 JWT 的 `tenant_id` claim 中携带。

## 2. 上传合同文件（Storage）
1. 在前端或脚本里创建签名上传：
   ```ts
   const client = createClient(supabaseUrl, supabaseAnonKey);
   const { data } = await client.storage.from('contracts').createSignedUploadUrl(
     `tenant/${tenantId}/${file.name}`,
     60, // URL 有效期秒数
     {
       upsert: true,
       contentType: file.type,
       metadata: { tenant_id: tenantId },
     }
   );
   ```
2. 将文件作为 `multipart/form-data` 上传到 `data.signedUrl`。
3. 记录 `storage_path`（示例：`tenant/${tenantId}/contract-001.pdf`）。

> 若在本地命令行测试，可临时使用 `npx supabase storage cp local.pdf contracts/tenant/<tenant_id>/contract-001.pdf`。由于 CLI 使用 service role，上传后请在数据库手动为该文件补写 `metadata->>'tenant_id'`，或在 `storage.objects` 里执行 `update storage.objects set metadata = jsonb_build_object('tenant_id', '<tenant_id>') where name = 'tenant/<tenant_id>/contract-001.pdf';`。

## 3. 调用 `ingest-doc` 函数
```
curl https://crndpzhpvhcncoscoiba.functions.supabase.co/ingest-doc \
  -H "Authorization: Bearer <Supabase JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant_id>",
    "title": "采购合同",
    "counterparty": "供应商A",
    "storage_path": "tenant/<tenant_id>/contract-001.pdf",
    "metadata": {"uploaded_by": "demo"}
  }'
```
返回的 JSON 包含 `contract_id`, `contract_version_id`, `task_id`。此时 `contracts`、`contract_versions`、`tasks` 表会新增记录，`tasks` 中的 `payload` 带有 `contract_version_id`，供解析 Agent 消费。

## 4. 解析与条款入库（待实现）
- 编写 Edge Function 或外部 Worker 监听 `tasks` 表，取出 `task_type = 'ingestion'` 的记录。
- 下载 `storage_path` 指向的文件，进行 OCR/分块，输出条款列表。
- 将条款写入 `clauses` 表（字段：`contract_version_id`, `clause_no`, `title`, `body`, `embedding`）。
- 完成后更新 `tasks.status = 'completed'`。

## 5. 调用 `risk-analyzer`
```
curl https://crndpzhpvhcncoscoiba.functions.supabase.co/risk-analyzer \
  -H "Authorization: Bearer <Supabase JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant_id>",
    "contract_version_id": "<version_id>"
  }'
```
函数会从 `clauses` 拉取条款，调用 LLM 生成风险 JSON 并写入 `risk_findings`。可在 `risk_findings` 表查看每条条款的风险等级、建议及法规引用。

## 6. 问题排查
- 若 Storage 访问被拒绝，检查上传使用的 JWT 是否带 `tenant_id`，以及对象的 `metadata->>'tenant_id'` 是否匹配。
- `ingest-doc` 失败时看 Functions 面板日志，确认 Storage 路径或租户 ID 正确。
- `risk-analyzer` 未生成数据时检查 `clauses` 是否已有内容，以及 LLM 接口返回 JSON 是否被成功解析。

按照以上步骤，即可完成一次从上传、入库、解析到风险识别的闭环，后续可将解析 Agent、通知、版本 diff 等模块接入到同一任务流中。

## 7. OCR 配置
- 在 Supabase secrets 中设置：`OCR_BASE_URL`（如 https://api.siliconflow.cn）、`OCR_API_KEY`（DeepSeek OCR 密钥）、`OCR_MODEL_ID`（默认 `deepseek-ai/DeepSeek-OCR`）。
- 可选：`CONTRACTS_BUCKET` 用于指定存储桶名称。
- `task-runner` 会下载 Storage 中的合同文件，转为 Base64 传给 DeepSeek OCR，获取纯文本后再调用条款解析。

