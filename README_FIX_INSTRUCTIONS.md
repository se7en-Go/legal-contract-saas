# 🚨 任务队列问题紧急修复说明

## 问题分析

根据您的截图和信息，我发现了以下关键问题：

### 1. **GitHub Actions 正常运行** ✅
- ✅ 两个工作流都在运行：`Invoke Task Runner` 和 `Enhanced Task Runner System`
- ✅ 代码已成功推送到远程仓库
- ✅ GitHub Actions 配置正确

### 2. **核心问题：授权失败** ❌
- ❌ Task Runner v2 返回：`{"code":401,"message":"Missing authorization header"}`
- ❌ GitHub Actions 缺少正确的 `PROJECT_SERVICE_ROLE_KEY` 或 `TASK_RUNNER_TOKEN`
- ❌ Edge Functions 需要正确的 Service Role JWT 才能执行

### 3. **任务状态问题** ❌
- ❌ UUID: `5bb97fc4-efe1-4d95-b48d-04b42aee0892` → status: `failed`
- ❌ UUID: `60aed9e9-92df-49ca-afbe-256fc69d1ddb` → status: `queued`
- ❌ 数据库修复脚本未生效

## 🔧 立即解决方案

### 步骤 1: 修复 GitHub Actions Secrets

您需要在 GitHub 仓库中添加正确的 secrets：

1. 访问：`https://github.com/se7en-Go/legal-contract-saas/settings/secrets/actions`
2. 添加以下 secrets：

**Secret 1: `PROJECT_SERVICE_ROLE_KEY`**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybmRwenhodmhobmNvc2NvaWJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDAwODUxNywiZXhwIjoyMDQ5NTg0NTE3fQ.Mg4UKokQRWkzZQK1L5YAw0yfTBw7A6bLo3YjKb_JnNk
```

**Secret 2: `TASK_RUNNER_TOKEN`**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybmRwenhodmhobmNvc2NvaWJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDAwODUxNywiZXhwIjoyMDQ5NTg0NTE3fQ.Mg4UKokQRWkzZQK1L5YAw0yfTBw7A6bLo3YjKb_JnNk
```

### 步骤 2: 手动执行任务修复

添加 secrets 后，您需要手动触发一次工作流：

1. 访问：`https://github.com/se7en-Go/legal-contract-saas/actions`
2. 点击 `Enhanced Task Runner System` 工作流
3. 点击 `Run workflow` 按钮
4. 选择 `action: process`
5. 点击 `Run workflow`

### 步骤 3: 验证修复效果

1. **检查 GitHub Actions**：确认工作流成功执行
2. **检查任务状态**：访问 `http://localhost:3000/tasks`
3. **验证处理**：任务应该从 `queued` → `processing` → `completed`

### 步骤 4: 如果还需要手动修复

如果 GitHub Actions 仍然无法正常工作，请在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 重置失败任务
UPDATE tasks
SET
    status = 'queued',
    worker_id = NULL,
    started_at = NULL,
    timeout_at = NULL,
    retry_count = 0,
    last_error = NULL,
    priority = 1,
    updated_at = now()
WHERE id = '5bb97fc4-efe1-4d95-b48d-04b42aee0892';

-- 确保另一个 queued 任务优先处理
UPDATE tasks
SET
    status = 'queued',
    worker_id = NULL,
    started_at = NULL,
    timeout_at = NULL,
    retry_count = 0,
    last_error = NULL,
    priority = 1,
    updated_at = now()
WHERE id = '60aed9e9-92df-49ca-afbe-256fc69d1ddb';
```

## 🎯 关于原始 task-runner 的处理

**不需要删除原始 task-runner**，建议保留作为备份：

1. **两个版本并存**：
   - `task-runner` (v43) - 原始版本，作为备份
   - `task-runner-v2` (v1) - 新版本，多worker并行

2. **GitHub Actions 已配置故障转移**：
   - 如果 task-runner-v2 失败，会自动使用 task-runner

3. **逐步迁移**：
   - 等待 task-runner-v2 稳定运行后再考虑移除原始版本

## 🔍 问题根因分析

1. **授权配置缺失**：GitHub Actions secrets 未正确配置
2. **Token 过期**：Service Role Key 可能已过期
3. **环境变量不一致**：本地和云端环境变量不同步

## ✅ 验证清单

- [ ] GitHub Actions secrets 已添加
- [ ] 工作流手动触发成功
- [ ] 任务状态从 `failed` → `queued`
- [ ] 任务处理正常：`queued` → `processing` → `completed`
- [ ] 前端页面显示更新
- [ ] 新上传的合同正常处理

## 📞 如果仍有问题

如果按照上述步骤操作后问题仍然存在，请：

1. 截图 GitHub Actions 的运行日志
2. 提供 Supabase Dashboard 中 Functions 的日志
3. 确认 secrets 配置是否正确复制

这样我可以进一步诊断和解决问题。