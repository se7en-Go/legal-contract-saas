-- 立即修复任务问题 - 2025-12-11
-- 解决数据库约束错误

-- 1. 删除有问题的task_metrics记录（清理错误数据）
DELETE FROM task_metrics WHERE task_type IS NULL OR task_id IS NULL;

-- 2. 删除有问题的task_attempts记录（清理错误数据）
DELETE FROM task_attempts WHERE task_id IS NULL;

-- 3. 立即重置用户的两个任务
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
WHERE id IN (
    '5bb97fc4-efe1-4d95-b48d-04b42aee0892',
    '60aed9e9-92df-49ca-afbe-256fc69d1ddb'
);

-- 4. 确保所有必需字段都有值
UPDATE tasks
SET
    priority = COALESCE(priority, 5)
WHERE priority IS NULL;

-- 5. 删除无效的任务记录（没有contract_version_id的ingestion任务）
DELETE FROM task_attempts
WHERE id IN (
    SELECT id FROM tasks
    WHERE task_type = 'ingestion'
    AND (payload->>'contract_version_id') IS NULL
);

-- 6. 输出修复结果
SELECT
    'Task Fix Applied' as action,
    now() as fix_time;

-- 7. 显示修复后的任务状态
SELECT
    id,
    status,
    task_type,
    priority,
    retry_count,
    last_error,
    created_at,
    updated_at
FROM tasks
WHERE id IN (
    '5bb97fc4-efe1-4d95-b48d-04b42aee0892',
    '60aed9e9-92df-49ca-afbe-256fc69d1ddb'
)
ORDER BY created_at DESC;