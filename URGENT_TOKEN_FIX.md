# 🚨 紧急Token修复说明

## 问题诊断
GitHub Actions健康检查失败，原因是JWT token无效（`Invalid JWT`）

## 🔧 立即解决方案

### 方法1: 从Supabase Dashboard获取（推荐）

1. **访问Supabase Dashboard**:
   ```
   https://app.supabase.com/project/crndpzhpvhcncoscoiba/settings/api
   ```

2. **获取Service Role Key**:
   - 找到 "Project API keys" 部分
   - 复制 `service_role` key（不是`anon` key）

3. **更新GitHub Actions Secrets**:
   - 访问：`https://github.com/se7en-Go/legal-contract-saas/settings/secrets/actions`
   - 更新/添加：
     ```
     PROJECT_SERVICE_ROLE_KEY: [复制的新key]
     TASK_RUNNER_TOKEN: [复制的新key]
     ```

### 方法2: 使用Supabase CLI（如果可用）

```bash
# 在项目根目录执行
supabase status --output json
```

### 方法3: 检查本地环境变量

检查是否有 `.env.local` 文件：
```bash
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY
```

## 🎯 修复后验证

1. **等待1-2分钟**让GitHub Actions更新secrets
2. **重新运行工作流**:
   - 访问：`https://github.com/se7en-Go/legal-contract-saas/actions`
   - 点击 `Enhanced Task Runner System` → `Run workflow`
   - 使用相同参数：`process`, `ingestion`, `3`

## 🔍 如果仍然失败

### 检查Edge Function状态
```bash
supabase functions list
```

### 重新部署Task Runner
```bash
supabase functions deploy task-runner-v2
```

### 检查函数日志
在Supabase Dashboard → Edge Functions → task-runner-v2 → Logs

## 💡 重要提醒

- **Service Role Key**不是**登录用户的JWT token
- **Service Role Key**是**服务器端密钥，具有完全权限
- **不要**在客户端代码中使用Service Role Key
- **只在**服务器端和GitHub Actions中使用

## 📋 验证清单

- [ ] 已获取最新的Service Role Key
- [ ] 已更新GitHub Actions secrets
- [ ] GitHub Actions工作流成功运行
- [ ] 任务状态从failed/queued变为processing/completed
- [ ] 前端页面显示更新