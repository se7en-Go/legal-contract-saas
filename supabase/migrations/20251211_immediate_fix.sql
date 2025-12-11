-- 立即修复任务状态 - 2025-12-11
-- 解决用户报告的具体任务问题

-- 1. 立即重置失败任务
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

-- 2. 确保另一个 queued 任务优先处理
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

-- 3. 重置所有卡在 processing 状态的任务
UPDATE tasks
SET
    status = 'queued',
    worker_id = NULL,
    started_at = NULL,
    timeout_at = NULL,
    retry_count = COALESCE(retry_count, 0) + 1,
    last_error = 'Auto-recovered from stuck processing state',
    updated_at = now()
WHERE status = 'processing'
AND updated_at < now() - interval '10 minutes';

-- 4. 修复数据库字段约束（确保新字段存在）
DO $$
BEGIN
    -- 确保新字段存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'worker_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN worker_id text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN started_at timestamptz;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'timeout_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN timeout_at timestamptz;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'priority'
    ) THEN
        ALTER TABLE tasks ADD COLUMN priority integer NOT NULL DEFAULT 5;
    END IF;
END $$;

-- 5. 创建批量任务获取函数（如果不存在）
CREATE OR REPLACE FUNCTION fetch_queued_tasks(
    p_worker_id text DEFAULT session_user,
    p_batch_size integer DEFAULT 3,
    p_task_type text DEFAULT NULL
)
RETURNS TABLE(
    task_id uuid,
    tenant_id uuid,
    task_type text,
    payload jsonb,
    retry_count integer,
    priority integer
) AS $$
BEGIN
    RETURN QUERY
    UPDATE tasks
    SET
        status = 'processing',
        worker_id = p_worker_id,
        started_at = now(),
        timeout_at = now() + interval '10 minutes',
        updated_at = now()
    WHERE id IN (
        SELECT id FROM tasks
        WHERE
            status = 'queued'
            AND (p_task_type IS NULL OR task_type = p_task_type)
            AND (timeout_at IS NULL OR timeout_at < now())
        ORDER BY priority DESC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    RETURNING id, tenant_id, task_type, payload, retry_count, priority;
END;
$$ LANGUAGE plpgsql;

-- 6. 输出修复结果
SELECT
    'Immediate Fix Applied' as action,
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
WHERE id IN ('5bb97fc4-efe1-4d95-b48d-04b42aee0892', '60aed9e9-92df-49ca-afbe-256fc69d1ddb')
ORDER BY created_at DESC;

-- 8. 显示任务统计
SELECT
    status,
    COUNT(*) as count
FROM tasks
GROUP BY status
ORDER BY count DESC;