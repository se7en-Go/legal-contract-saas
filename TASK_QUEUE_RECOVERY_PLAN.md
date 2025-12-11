# 任务队列系统全面修复方案

## 🎯 问题诊断总结

### 当前系统问题
1. **僵尸任务**: UUID `60aed9e9-92df-49ca-afbe-256fc69d1ddb` 一直处于queued状态
2. **单线程瓶颈**: Task Runner只能逐个处理任务，无法并行
3. **缺乏分布式锁**: 多个worker可能同时处理同一任务
4. **无超时机制**: processing状态的任务可能无限期卡住
5. **监控盲区**: 缺乏任务队列状态监控和告警
6. **错误处理不足**: 重试机制不够完善

### 根本原因分析
- 原始Task Runner设计为单次调用单任务处理
- 缺乏分布式工作协调机制
- 没有任务优先级和超时控制
- GitHub Actions配置过于简单

## 🚀 完整修复方案

### 阶段1: 立即修复 (立即执行)

#### 1.1 数据库修复
**文件**: `supabase/migrations/20251211_task_queue_fix.sql`

**目标**:
- 立即修复僵尸任务 `60aed9e9-92df-49ca-afbe-256fc69d1ddb`
- 添加任务监控字段 (`timeout_at`, `worker_id`, `started_at`, `priority`)
- 创建分布式锁函数
- 添加任务清理和超时检查机制

**执行步骤**:
```sql
-- 1. 立即执行数据库迁移
supabase db push

-- 2. 手动修复僵尸任务
UPDATE tasks
SET status = 'queued', worker_id = NULL, started_at = NULL, timeout_at = NULL, retry_count = 0
WHERE id = '60aed9e9-92df-49ca-afbe-256fc69d1ddb';
```

#### 1.2 紧急任务处理
**手动触发GitHub Actions**:
```bash
# 1. 立即触发任务处理
gh workflow run enhanced-task-runner.yml -f action=process

# 2. 检查任务状态
gh workflow run enhanced-task-runner.yml -f action=health
```

### 阶段2: 短期改进 (1-2天内)

#### 2.1 部署新的Task Runner v2
**文件**: `supabase/functions/task-runner-v2/index.ts`

**核心改进**:
- ✅ 支持批量任务处理 (默认3个并行)
- ✅ 分布式锁机制 (使用 `FOR UPDATE SKIP LOCKED`)
- ✅ 工作节点ID识别 (`worker-${uuid}-${timestamp}`)
- ✅ 任务超时控制 (默认10分钟)
- ✅ 详细的指标记录和监控
- ✅ 健康检查和维护模式

**部署步骤**:
```bash
# 1. 部署新函数
supabase functions deploy task-runner-v2

# 2. 测试新函数
curl -X GET "https://crndpzhpvhcncoscoiba.functions.supabase.co/task-runner-v2?action=health" \
  -H "Authorization: Bearer $TASK_RUNNER_TOKEN"
```

#### 2.2 升级GitHub Actions
**文件**: `.github/workflows/enhanced-task-runner.yml`

**改进内容**:
- ✅ 多worker并行处理 (3个并行worker)
- ✅ 健康检查和故障转移
- ✅ 定时维护任务 (每小时)
- ✅ 深度清理任务 (每天)
- ✅ 执行监控和报告
- ✅ 错误通知机制

**部署步骤**:
```bash
# 1. 替换现有workflow
mv .github/workflows/run-task-runner.yml .github/workflows/run-task-runner.yml.backup
mv .github/workflows/enhanced-task-runner.yml .github/workflows/run-task-runner.yml

# 2. 提交并推送
git add .github/workflows/
git commit -m "feat: 升级任务队列为分布式并行处理系统"
git push origin main
```

### 阶段3: 长期优化 (1周内)

#### 3.1 监控仪表板
创建任务队列监控界面，显示:
- 当前任务队列状态
- 任务处理统计 (吞吐量、成功率、平均处理时间)
- 工作节点状态
- 错误率和重试统计

#### 3.2 告警机制
- 任务积压超过阈值告警
- 失败率过高告警
- worker异常离线告警

#### 3.3 性能优化
- 动态调整worker数量
- 任务优先级算法优化
- 智能重试策略

## 📊 技术实现细节

### 分布式锁实现
```sql
-- 使用 PostgreSQL 的 FOR UPDATE SKIP LOCKED
SELECT id FROM tasks
WHERE status = 'queued'
ORDER BY priority DESC, created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT batch_size;
```

### Worker ID 生成
```typescript
const WORKER_ID = `worker-${crypto.randomUUID()}-${Date.now()}`;
```

### 批量处理流程
1. 获取分布式锁
2. 批量读取任务 (SKIP LOCKED)
3. 并行处理任务
4. 更新任务状态
5. 记录处理指标

### 超时处理
- `timeout_at` 字段标记任务超时时间
- 定期检查超时任务并重新排队
- 防止任务无限期卡住

## 🔧 环境变量配置

### 新增环境变量
```bash
# Task Runner v2 配置
TASK_BATCH_SIZE=3              # 每批处理任务数量
TASK_TIMEOUT_MINUTES=10        # 任务超时时间
TASK_MAX_ATTEMPTS=3            # 最大重试次数

# 原有配置保持不变
PROJECT_SERVICE_ROLE_KEY=xxx
CONTRACTS_BUCKET=contracts
OCR_BASE_URL=xxx
OCR_API_KEY=xxx
OCR_MODEL_ID=xxx
```

## 📈 监控指标

### 关键指标
- **吞吐量**: 每分钟处理任务数
- **延迟**: 任务在队列中等待时间
- **成功率**: 任务完成百分比
- **重试率**: 需要重试的任务比例
- **Worker利用率**: active worker / total worker

### 查询语句
```sql
-- 任务统计
SELECT task_type, status, COUNT(*) as count
FROM tasks
GROUP BY task_type, status;

-- 处理时间统计
SELECT task_type, status, AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
FROM tasks
WHERE status IN ('completed', 'failed')
GROUP BY task_type, status;

-- Worker 统计
SELECT worker_id, COUNT(*) as tasks_processed, status
FROM task_metrics
WHERE recorded_at > now() - interval '1 hour'
GROUP BY worker_id, status;
```

## 🚨 应急预案

### 如果新系统出现问题
1. **立即回退**: 停用新workflow，启用备份的原始workflow
2. **手动处理**: 直接调用原始task-runner函数处理积压任务
3. **数据恢复**: 使用数据库备份恢复任务状态

### 回退命令
```bash
# 回退到原始workflow
mv .github/workflows/run-task-runner.yml.backup .github/workflows/run-task-runner.yml
git add .github/workflows/run-task-runner.yml
git commit -m "rollback: 回退到原始任务处理器"
git push origin main
```

## 🎯 验证清单

### 立即修复验证
- [ ] 僵尸任务 `60aed9e9-92df-49ca-afbe-256fc69d1ddb` 状态变为正常
- [ ] 数据库迁移成功执行
- [ ] 新字段添加完成

### 短期改进验证
- [ ] Task Runner v2 部署成功
- [ ] 健康检查通过
- [ ] 多worker并行处理正常工作
- [ ] GitHub Actions执行成功

### 长期优化验证
- [ ] 监控仪表板正常显示
- [ ] 告警机制工作正常
- [ ] 性能指标达标

## 📞 支持联系

如果遇到问题，请按以下顺序联系:
1. 检查GitHub Actions执行日志
2. 查看Task Runner函数日志
3. 检查数据库任务状态
4. 回顾此文档的应急预案

---

**最后更新**: 2025-12-11
**版本**: 1.0
**状态**: 准备执行