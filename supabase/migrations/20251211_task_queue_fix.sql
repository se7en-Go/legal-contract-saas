-- 任务队列修复脚本
-- 修复僵尸任务，添加监控和超时机制

-- 1. 修复僵尸任务：将长时间queued的任务重置或标记为失败
UPDATE tasks
SET
    status = CASE
        WHEN created_at < now() - interval '30 minutes' THEN 'failed'
        ELSE status
    END,
    last_error = CASE
        WHEN created_at < now() - interval '30 minutes' THEN 'Task timeout after 30 minutes in queue'
        ELSE last_error
    END,
    updated_at = now()
WHERE
    status = 'queued'
    AND created_at < now() - interval '30 minutes';

-- 2. 添加任务超时监控字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'timeout_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN timeout_at timestamptz;
        COMMENT ON COLUMN tasks.timeout_at IS '任务超时时间';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'worker_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN worker_id text;
        COMMENT ON COLUMN tasks.worker_id IS '处理任务的工作节点ID';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN started_at timestamptz;
        COMMENT ON COLUMN tasks.started_at IS '任务开始处理时间';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'priority'
    ) THEN
        ALTER TABLE tasks ADD COLUMN priority integer NOT NULL DEFAULT 5;
        COMMENT ON COLUMN tasks.priority IS '任务优先级 (1-10, 1为最高)';
    END IF;
END $$;

-- 3. 创建任务监控索引
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_type_status ON tasks(task_type, status);
CREATE INDEX IF NOT EXISTS idx_tasks_worker_id ON tasks(worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_timeout ON tasks(timeout_at) WHERE timeout_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_priority_created ON tasks(priority DESC, created_at);

-- 4. 创建任务统计视图
CREATE OR REPLACE VIEW task_stats AS
SELECT
    task_type,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, created_at) - created_at))) as avg_duration_seconds,
    MIN(created_at) as oldest_task,
    MAX(created_at) as newest_task
FROM tasks
GROUP BY task_type, status;

-- 5. 创建任务清理函数
CREATE OR REPLACE FUNCTION cleanup_old_tasks()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- 删除30天前的已完成任务
    DELETE FROM tasks
    WHERE status IN ('completed', 'failed')
    AND updated_at < now() - interval '30 days';

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;

    -- 记录清理日志
    INSERT INTO audit_logs (tenant_id, action, payload)
    SELECT
        tenant_id,
        'task_cleanup',
        json_build_object('cleaned_count', cleaned_count, 'cleanup_date', now())
    FROM tasks
    GROUP BY tenant_id
    LIMIT 1;

    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建任务超时检查函数
CREATE OR REPLACE FUNCTION check_task_timeouts()
RETURNS INTEGER AS $$
DECLARE
    timeout_count INTEGER;
BEGIN
    -- 将超时的processing状态任务标记为failed
    UPDATE tasks
    SET
        status = 'failed',
        last_error = 'Task processing timeout',
        updated_at = now()
    WHERE
        status = 'processing'
        AND started_at < now() - interval '10 minutes';

    GET DIAGNOSTICS timeout_count = ROW_COUNT;

    -- 记录超时日志
    IF timeout_count > 0 THEN
        INSERT INTO audit_logs (tenant_id, action, payload)
        SELECT
            tenant_id,
            'task_timeout',
            json_build_object('timeout_count', timeout_count, 'timeout_date', now())
        FROM tasks
        WHERE status = 'failed' AND last_error = 'Task processing timeout'
        GROUP BY tenant_id
        LIMIT 1;
    END IF;

    RETURN timeout_count;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建分布式锁函数
CREATE OR REPLACE FUNCTION acquire_task_lock(
    p_task_id UUID,
    p_worker_id TEXT,
    p_timeout_minutes INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 尝试获取任务锁
    UPDATE tasks
    SET
        status = 'processing',
        worker_id = p_worker_id,
        started_at = now(),
        timeout_at = now() + interval '1 minute' * p_timeout_minutes,
        updated_at = now()
    WHERE
        id = p_task_id
        AND status = 'queued'
        AND (worker_id IS NULL OR worker_id = p_worker_id);

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建批量获取任务函数
CREATE OR REPLACE FUNCTION fetch_queued_tasks(
    p_worker_id TEXT,
    p_batch_size INTEGER DEFAULT 5,
    p_task_type TEXT DEFAULT NULL
)
RETURNS SETOF UUID AS $$
BEGIN
    -- 使用 FOR UPDATE SKIP LOCKED 避免锁竞争
    RETURN QUERY
    UPDATE tasks
    SET
        status = 'processing',
        worker_id = p_worker_id,
        started_at = now(),
        timeout_at = now() + interval '10 minutes',
        updated_at = now()
    WHERE
        id IN (
            SELECT id
            FROM tasks
            WHERE
                status = 'queued'
                AND (p_task_type IS NULL OR task_type = p_task_type)
                AND (timeout_at IS NULL OR timeout_at < now())
            ORDER BY priority DESC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT p_batch_size
        )
    RETURNING id;
END;
$$ LANGUAGE plpgsql;

-- 9. 创建任务重试函数
CREATE OR REPLACE FUNCTION retry_failed_tasks(
    p_task_type TEXT DEFAULT NULL,
    p_max_retry_count INTEGER DEFAULT 3
)
RETURNS INTEGER AS $$
DECLARE
    retry_count INTEGER;
BEGIN
    -- 重试符合条件的失败任务
    UPDATE tasks
    SET
        status = 'queued',
        worker_id = NULL,
        started_at = NULL,
        timeout_at = NULL,
        updated_at = now()
    WHERE
        status = 'failed'
        AND retry_count < p_max_retry_count
        AND (p_task_type IS NULL OR task_type = p_task_type)
        AND updated_at < now() - interval '5 minutes'; -- 5分钟后重试

    GET DIAGNOSTICS retry_count = ROW_COUNT;

    RETURN retry_count;
END;
$$ LANGUAGE plpgsql;

-- 10. 立即修复当前僵尸任务
UPDATE tasks
SET
    status = 'queued',
    worker_id = NULL,
    started_at = NULL,
    timeout_at = NULL,
    retry_count = CASE
        WHEN id = '60aed9e9-92df-49ca-afbe-256fc69d1ddb' THEN 0
        ELSE retry_count
    END,
    last_error = NULL,
    updated_at = now()
WHERE
    id = '60aed9e9-92df-49ca-afbe-256fc69d1ddb';

-- 11. 创建任务监控表
CREATE TABLE IF NOT EXISTS task_metrics (
    id uuid primary key default gen_random_uuid(),
    worker_id text not null,
    task_type text not null,
    status text not null,
    duration_seconds numeric,
    error_message text,
    recorded_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_task_metrics_worker_recorded ON task_metrics(worker_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_task_metrics_type_status ON task_metrics(task_type, status);

-- 12. 插入初始监控数据
INSERT INTO task_metrics (worker_id, task_type, status, recorded_at)
VALUES ('system_init', 'ingestion', 'monitor_started', now())
ON CONFLICT DO NOTHING;

COMMIT;

-- 输出修复结果
SELECT
    'Task Queue Repair Summary' as action,
    now() as repair_time;

SELECT
    task_type,
    status,
    COUNT(*) as task_count
FROM tasks
GROUP BY task_type, status
ORDER BY task_type, status;