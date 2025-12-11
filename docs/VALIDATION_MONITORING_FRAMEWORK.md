# 验证和监控框架：任务队列系统可靠性保障

## 框架概述

本文档建立了任务队列系统的全面验证和监控框架，确保系统修复后的可靠性和持续稳定运行。框架采用多层次验证策略和实时监控机制，实现问题早发现、早响应、早解决。

## 验证框架架构

### 三层验证体系
```
应用层验证 ← 业务层验证 ← 基础设施层验证
     ↓             ↓             ↓
功能正确性     业务完整性     系统可用性
用户体验     数据准确性     资源健康度
```

### 验证矩阵
| 验证层级 | 验证内容 | 验证方法 | 验证频率 |
|---------|---------|---------|---------|
| **基础设施层** | 数据库连接、API可用性 | 健康检查、连通性测试 | 实时 (每分钟) |
| **应用层** | 任务处理逻辑、函数执行 | 单元测试、集成测试 | 部署时、变更后 |
| **业务层** | 合同处理准确性、数据完整性 | 端到端测试、数据校验 | 每日、每周 |

## 实时监控系统

### 1. 核心监控指标

#### 1.1 系统可用性指标
```sql
-- 健康检查视图
CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT
    'system_health' as metric_category,
    (SELECT COUNT(*) > 0 FROM tasks WHERE created_at > NOW() - INTERVAL '1 hour') as recent_activity,
    (SELECT COUNT(*) FROM tasks WHERE status = 'processing' AND started_at > NOW() - INTERVAL '10 minutes') as active_workers,
    (SELECT COUNT(*) FROM tasks WHERE status = 'queued' AND created_at < NOW() - INTERVAL '15 minutes') as stale_queued_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'failed' AND updated_at > NOW() - INTERVAL '1 hour') as recent_failures,
    NOW() as check_time;
```

#### 1.2 性能监控指标
```sql
-- 性能监控视图
CREATE OR REPLACE VIEW performance_metrics AS
SELECT
    DATE_TRUNC('minute', created_at) as time_bucket,
    COUNT(*) as tasks_created,
    COUNT(*) FILTER (WHERE status = 'completed') as tasks_completed,
    COUNT(*) FILTER (WHERE status = 'failed') as tasks_failed,
    AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, NOW()) - created_at))) as avg_processing_time_seconds,
    COUNT(DISTINCT worker_id) as unique_workers
FROM tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time_bucket
ORDER BY time_bucket DESC;
```

#### 1.3 数据质量监控
```sql
-- 数据质量检查
CREATE OR REPLACE VIEW data_quality_dashboard AS
SELECT
    'data_quality' as metric_type,
    (SELECT COUNT(*) FROM tasks WHERE payload IS NULL OR payload = '{}') as invalid_payload_count,
    (SELECT COUNT(*) FROM tasks WHERE contract_version_id IS NULL AND task_type = 'ingestion') as missing_contract_ref,
    (SELECT COUNT(*) FROM task_attempts WHERE message IS NULL AND status = 'failed') as failed_without_error,
    (SELECT COUNT(DISTINCT tenant_id) FROM tasks WHERE created_at > NOW() - INTERVAL '24 hours') as active_tenants_today;
```

### 2. 实时监控脚本

#### 2.1 系统健康监控
```bash
#!/bin/bash
# health_monitor.sh - 系统健康监控脚本

LOG_FILE="/var/log/task_queue_monitor.log"
ALERT_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
SUPABASE_URL="https://crndpzhpvhcncoscoiba.supabase.co"
SUPABASE_KEY="your-service-role-key"

# 日志记录函数
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
}

# 发送告警函数
send_alert() {
    local severity="$1"
    local message="$2"

    local color="good"
    case "$severity" in
        "critical") color="danger" ;;
        "warning") color="warning" ;;
        "info") color="good" ;;
    esac

    curl -X POST "$ALERT_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 $severity: $message\", \"color\": \"$color\"}"

    log_message "ALERT ($severity): $message"
}

# 检查数据库连接
check_database_connection() {
    local result=$(curl -s -w "%{http_code}" "$SUPABASE_URL/rest/v1/" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -o /dev/null)

    if [ "$result" != "200" ]; then
        send_alert "critical" "数据库连接失败 (HTTP $result)"
        return 1
    fi

    log_message "数据库连接正常"
    return 0
}

# 检查任务队列状态
check_task_queue_status() {
    local query="
    SELECT
        queued_count,
        processing_count,
        failed_count,
        CASE
            WHEN queued_count > 20 THEN 'critical'
            WHEN queued_count > 10 THEN 'warning'
            ELSE 'info'
        END as alert_level
    FROM (
        SELECT
            COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
            COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_count
        FROM tasks
        WHERE task_type = 'ingestion'
    ) t
    "

    local result=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/check_queue_health" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d "{}")

    local queued_count=$(echo "$result" | jq -r '.queued_count // 0')
    local processing_count=$(echo "$result" | jq -r '.processing_count // 0')
    local failed_count=$(echo "$result" | jq -r '.failed_count // 0')

    log_message "队列状态: Queued=$queued_count, Processing=$processing_count, Failed=$failed_count"

    if [ "$queued_count" -gt 20 ]; then
        send_alert "critical" "任务积压严重: $queued_count 个任务等待处理"
    elif [ "$queued_count" -gt 10 ]; then
        send_alert "warning" "任务积压告警: $queued_count 个任务等待处理"
    fi

    if [ "$processing_count" -gt 5 ]; then
        send_alert "info" "高并发处理: $processing_count 个任务正在执行"
    fi
}

# 检查Worker健康状态
check_worker_health() {
    local query="
    SELECT
        active_workers,
        stalled_workers,
        CASE
            WHEN active_workers < 1 THEN 'critical'
            WHEN stalled_workers > 0 THEN 'warning'
            ELSE 'info'
        END as alert_level
    FROM (
        SELECT
            COUNT(DISTINCT worker_id) FILTER (WHERE status = 'processing' AND started_at > NOW() - INTERVAL '10 minutes') as active_workers,
            COUNT(DISTINCT worker_id) FILTER (WHERE status = 'processing' AND started_at < NOW() - INTERVAL '15 minutes') as stalled_workers
        FROM tasks
    ) t
    "

    local result=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/check_worker_health" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" \
        -H "Content-Type: application/json" \
        -d "{}")

    local active_workers=$(echo "$result" | jq -r '.active_workers // 0')
    local stalled_workers=$(echo "$result" | jq -r '.stalled_workers // 0')

    log_message "Worker状态: Active=$active_workers, Stalled=$stalled_workers"

    if [ "$active_workers" -lt 1 ]; then
        send_alert "critical" "没有活跃的Worker，任务处理已停止"
    fi

    if [ "$stalled_workers" -gt 0 ]; then
        send_alert "warning" "发现 $stalled_workers 个卡死的Worker"
    fi
}

# 检查Task Runner函数健康状态
check_task_runner_health() {
    local function_urls=(
        "https://crndpzhpvhcncoscoiba.functions.supabase.co/task-runner-v2"
        "https://crndpzhpvhcncoscoiba.functions.supabase.co/task-runner"
    )

    for url in "${function_urls[@]}"; do
        local health_check="$url?action=health"
        local result=$(curl -s -w "%{http_code}" "$health_check" \
            -H "Authorization: Bearer $SUPABASE_KEY" \
            -H "Content-Type: application/json" \
            -o /dev/null)

        if [ "$result" != "200" ]; then
            send_alert "critical" "Task Runner健康检查失败: $url (HTTP $result)"
        else
            log_message "Task Runner健康检查通过: $url"
        fi
    done
}

# 主监控循环
main_monitor() {
    log_message "启动任务队列监控系统"

    while true; do
        check_database_connection
        check_task_queue_status
        check_worker_health
        check_task_runner_health

        log_message "监控周期完成，等待下次检查..."
        sleep 300  # 5分钟检查一次
    done
}

# 启动监控
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main_monitor
fi
```

#### 2.2 性能监控脚本
```python
#!/usr/bin/env python3
# performance_monitor.py - 性能监控和趋势分析

import requests
import time
import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any

class TaskQueuePerformanceMonitor:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json'
        }

    def get_current_metrics(self) -> Dict[str, Any]:
        """获取当前性能指标"""
        query = """
        SELECT
            COUNT(*) FILTER (WHERE status = 'queued') as queued_tasks,
            COUNT(*) FILTER (WHERE status = 'processing') as processing_tasks,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_today,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_today,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '24 hours') as avg_completion_time,
            COUNT(DISTINCT worker_id) FILTER (WHERE status = 'processing') as active_workers
        FROM tasks
        WHERE task_type = 'ingestion'
        """

        response = requests.post(
            f"{self.supabase_url}/rest/v1/rpc/get_current_metrics",
            headers=self.headers,
            json={}
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"获取指标失败: {response.status_code}")
            return {}

    def analyze_performance_trend(self, hours: int = 24) -> Dict[str, Any]:
        """分析性能趋势"""
        query = f"""
        SELECT
            DATE_TRUNC('hour', created_at) as hour_bucket,
            COUNT(*) as tasks_created,
            COUNT(*) FILTER (WHERE status = 'completed') as tasks_completed,
            COUNT(*) FILTER (WHERE status = 'failed') as tasks_failed,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed') as avg_processing_time
        FROM tasks
        WHERE created_at > NOW() - INTERVAL '{hours} hours'
        GROUP BY hour_bucket
        ORDER BY hour_bucket
        """

        response = requests.post(
            f"{self.supabase_url}/rest/v1/rpc/analyze_performance_trend",
            headers=self.headers,
            json={"hours": hours}
        )

        if response.status_code == 200:
            data = response.json()
            return self._calculate_trend_metrics(data)
        else:
            print(f"获取趋势数据失败: {response.status_code}")
            return {}

    def _calculate_trend_metrics(self, data: List[Dict]) -> Dict[str, Any]:
        """计算趋势指标"""
        if not data:
            return {}

        # 计算吞吐量趋势
        throughputs = [record['tasks_completed'] for record in data if record['tasks_completed']]
        avg_throughput = statistics.mean(throughputs) if throughputs else 0

        # 计算成功率趋势
        success_rates = []
        for record in data:
            total = record['tasks_completed'] + record['tasks_failed']
            if total > 0:
                success_rate = record['tasks_completed'] / total
                success_rates.append(success_rate)

        avg_success_rate = statistics.mean(success_rates) if success_rates else 0

        # 计算处理时间趋势
        processing_times = [record['avg_processing_time'] for record in data if record['avg_processing_time']]
        avg_processing_time = statistics.mean(processing_times) if processing_times else 0

        return {
            'avg_throughput_per_hour': avg_throughput,
            'avg_success_rate': avg_success_rate,
            'avg_processing_time_seconds': avg_processing_time,
            'total_hours_analyzed': len(data),
            'peak_throughput': max(throughputs) if throughputs else 0,
            'min_success_rate': min(success_rates) if success_rates else 0
        }

    def detect_performance_anomalies(self) -> List[Dict[str, Any]]:
        """检测性能异常"""
        anomalies = []
        current_metrics = self.get_current_metrics()

        # 检测任务积压异常
        queued_tasks = current_metrics.get('queued_tasks', 0)
        if queued_tasks > 20:
            anomalies.append({
                'type': 'task_backlog',
                'severity': 'critical',
                'value': queued_tasks,
                'threshold': 20,
                'message': f'任务积压严重: {queued_tasks} 个任务等待处理'
            })
        elif queued_tasks > 10:
            anomalies.append({
                'type': 'task_backlog',
                'severity': 'warning',
                'value': queued_tasks,
                'threshold': 10,
                'message': f'任务积压告警: {queued_tasks} 个任务等待处理'
            })

        # 检测处理时间异常
        avg_completion_time = current_metrics.get('avg_completion_time', 0)
        if avg_completion_time > 600:  # 10分钟
            anomalies.append({
                'type': 'processing_time',
                'severity': 'critical',
                'value': avg_completion_time,
                'threshold': 600,
                'message': f'平均处理时间过长: {avg_completion_time:.1f} 秒'
            })
        elif avg_completion_time > 300:  # 5分钟
            anomalies.append({
                'type': 'processing_time',
                'severity': 'warning',
                'value': avg_completion_time,
                'threshold': 300,
                'message': f'平均处理时间较长: {avg_completion_time:.1f} 秒'
            })

        # 检测失败率异常
        completed_today = current_metrics.get('completed_today', 0)
        failed_today = current_metrics.get('failed_today', 0)
        total_today = completed_today + failed_today

        if total_today > 0:
            failure_rate = failed_today / total_today
            if failure_rate > 0.1:  # 10%
                anomalies.append({
                    'type': 'failure_rate',
                    'severity': 'critical',
                    'value': failure_rate,
                    'threshold': 0.1,
                    'message': f'任务失败率过高: {failure_rate:.1%}'
                })
            elif failure_rate > 0.05:  # 5%
                anomalies.append({
                    'type': 'failure_rate',
                    'severity': 'warning',
                    'value': failure_rate,
                    'threshold': 0.05,
                    'message': f'任务失败率偏高: {failure_rate:.1%}'
                })

        return anomalies

    def generate_performance_report(self) -> str:
        """生成性能报告"""
        current_metrics = self.get_current_metrics()
        trend_metrics = self.analyze_performance_trend()
        anomalies = self.detect_performance_anomalies()

        report = f"""
# 任务队列性能报告
生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 当前状态
- 等待任务: {current_metrics.get('queued_tasks', 0)}
- 正在处理: {current_metrics.get('processing_tasks', 0)}
- 今日完成: {current_metrics.get('completed_today', 0)}
- 今日失败: {current_metrics.get('failed_today', 0)}
- 活跃Worker: {current_metrics.get('active_workers', 0)}
- 平均完成时间: {current_metrics.get('avg_completion_time', 0):.1f} 秒

## 性能趋势 (24小时)
- 平均吞吐量: {trend_metrics.get('avg_throughput_per_hour', 0):.1f} 任务/小时
- 平均成功率: {trend_metrics.get('avg_success_rate', 0):.1%}
- 平均处理时间: {trend_metrics.get('avg_processing_time_seconds', 0):.1f} 秒
- 峰值吞吐量: {trend_metrics.get('peak_throughput', 0)} 任务/小时

## 异常检测
"""

        if anomalies:
            for anomaly in anomalies:
                report += f"- {anomaly['message']}\n"
        else:
            report += "- 无异常检测\n"

        return report

    def run_continuous_monitoring(self, interval_minutes: int = 5):
        """持续监控"""
        print("启动性能监控系统...")

        while True:
            try:
                anomalies = self.detect_performance_anomalies()

                # 如果检测到严重异常，立即发送告警
                critical_anomalies = [a for a in anomalies if a['severity'] == 'critical']
                if critical_anomalies:
                    self._send_critical_alerts(critical_anomalies)

                # 每小时生成一次性能报告
                if datetime.now().minute == 0:
                    report = self.generate_performance_report()
                    self._send_hourly_report(report)

                time.sleep(interval_minutes * 60)

            except Exception as e:
                print(f"监控过程中发生错误: {e}")
                time.sleep(60)  # 出错时等待1分钟后重试

    def _send_critical_alerts(self, anomalies: List[Dict]):
        """发送严重告警"""
        # 实现告警发送逻辑 (Slack、邮件等)
        for anomaly in anomalies:
            print(f"CRITICAL ALERT: {anomaly['message']}")

    def _send_hourly_report(self, report: str):
        """发送小时报告"""
        # 实现报告发送逻辑
        print(f"HOURLY REPORT:\n{report}")

# 使用示例
if __name__ == "__main__":
    monitor = TaskQueuePerformanceMonitor(
        supabase_url="https://crndpzhpvhcncoscoiba.supabase.co",
        supabase_key="your-service-role-key"
    )

    # 运行持续监控
    monitor.run_continuous_monitoring(interval_minutes=5)
```

### 3. 验证测试套件

#### 3.1 自动化测试框架
```python
#!/usr/bin/env python3
# task_queue_validator.py - 任务队列验证测试套件

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import pytest

class TaskQueueValidator:
    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url
        self.auth_token = auth_token
        self.test_results = []

    async def run_all_validations(self) -> Dict[str, Any]:
        """运行所有验证测试"""
        print("开始任务队列系统验证...")

        validations = [
            self.test_basic_connectivity,
            self.test_health_check,
            self.test_task_creation,
            self.test_task_processing,
            self.test_parallel_processing,
            self.test_error_handling,
            self.test_performance_benchmarks,
            self.test_data_integrity
        ]

        for validation in validations:
            try:
                result = await validation()
                self.test_results.append(result)
                print(f"✅ {validation.__name__}: {result['status']}")
            except Exception as e:
                self.test_results.append({
                    'test': validation.__name__,
                    'status': 'failed',
                    'error': str(e),
                    'timestamp': datetime.now()
                })
                print(f"❌ {validation.__name__}: {str(e)}")

        return self._generate_validation_report()

    async def test_basic_connectivity(self) -> Dict[str, Any]:
        """测试基本连接性"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/rest/v1/",
                headers={"apikey": self.auth_token}
            ) as response:
                return {
                    'test': 'basic_connectivity',
                    'status': 'passed' if response.status == 200 else 'failed',
                    'response_time': time.time(),
                    'timestamp': datetime.now()
                }

    async def test_health_check(self) -> Dict[str, Any]:
        """测试健康检查接口"""
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            async with session.get(
                f"{self.base_url}/functions/v1/task-runner-v2?action=health",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            ) as response:
                data = await response.json()
                response_time = time.time() - start_time

                return {
                    'test': 'health_check',
                    'status': 'passed' if response.status == 200 and data.get('status') == 'healthy' else 'failed',
                    'response_time': response_time,
                    'data': data,
                    'timestamp': datetime.now()
                }

    async def test_task_creation(self) -> Dict[str, Any]:
        """测试任务创建"""
        test_task = {
            "tenant_id": "test-tenant-123",
            "task_type": "ingestion",
            "payload": {
                "contract_version_id": "test-contract-456",
                "test_mode": True
            }
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/rest/v1/tasks",
                headers={
                    "apikey": self.auth_token,
                    "Authorization": f"Bearer {self.auth_token}",
                    "Content-Type": "application/json"
                },
                json=test_task
            ) as response:
                data = await response.json()

                return {
                    'test': 'task_creation',
                    'status': 'passed' if response.status in [200, 201] else 'failed',
                    'task_id': data.get('id'),
                    'timestamp': datetime.now()
                }

    async def test_task_processing(self) -> Dict[str, Any]:
        """测试任务处理"""
        # 先创建测试任务
        create_result = await self.test_task_creation()
        if create_result['status'] != 'passed':
            return {
                'test': 'task_processing',
                'status': 'failed',
                'error': 'Failed to create test task',
                'timestamp': datetime.now()
            }

        task_id = create_result['task_id']

        # 等待任务处理
        await asyncio.sleep(30)

        # 检查任务状态
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/rest/v1/tasks?id=eq.{task_id}",
                headers={"apikey": self.auth_token}
            ) as response:
                tasks = await response.json()

                if tasks:
                    task = tasks[0]
                    status = task.get('status')

                    return {
                        'test': 'task_processing',
                        'status': 'passed' if status in ['completed', 'processing'] else 'failed',
                        'task_status': status,
                        'task_id': task_id,
                        'timestamp': datetime.now()
                    }
                else:
                    return {
                        'test': 'task_processing',
                        'status': 'failed',
                        'error': 'Task not found',
                        'timestamp': datetime.now()
                    }

    async def test_parallel_processing(self) -> Dict[str, Any]:
        """测试并行处理能力"""
        # 创建多个测试任务
        task_ids = []

        async with aiohttp.ClientSession() as session:
            for i in range(5):
                test_task = {
                    "tenant_id": "test-tenant-123",
                    "task_type": "ingestion",
                    "payload": {
                        "contract_version_id": f"test-concert-{i}",
                        "test_mode": True
                    }
                }

                async with session.post(
                    f"{self.base_url}/rest/v1/tasks",
                    headers={
                        "apikey": self.auth_token,
                        "Authorization": f"Bearer {self.auth_token}",
                        "Content-Type": "application/json"
                    },
                    json=test_task
                ) as response:
                    data = await response.json()
                    if response.status in [200, 201]:
                        task_ids.append(data.get('id'))

        # 等待处理
        await asyncio.sleep(60)

        # 检查处理结果
        completed_count = 0
        async with aiohttp.ClientSession() as session:
            for task_id in task_ids:
                async with session.get(
                    f"{self.base_url}/rest/v1/tasks?id=eq.{task_id}",
                    headers={"apikey": self.auth_token}
                ) as response:
                    tasks = await response.json()
                    if tasks and tasks[0].get('status') == 'completed':
                        completed_count += 1

        return {
            'test': 'parallel_processing',
            'status': 'passed' if completed_count >= 3 else 'failed',  # 至少完成3个
            'total_tasks': len(task_ids),
            'completed_tasks': completed_count,
            'parallel_efficiency': completed_count / len(task_ids) if task_ids else 0,
            'timestamp': datetime.now()
        }

    async def test_error_handling(self) -> Dict[str, Any]:
        """测试错误处理"""
        # 创建一个会失败的任务
        error_task = {
            "tenant_id": "test-tenant-123",
            "task_type": "ingestion",
            "payload": {
                "contract_version_id": "non-existent-contract",
                "test_mode": True
            }
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/rest/v1/tasks",
                headers={
                    "apikey": self.auth_token,
                    "Authorization": f"Bearer {self.auth_token}",
                    "Content-Type": "application/json"
                },
                json=error_task
            ) as response:
                data = await response.json()

                if response.status in [200, 201]:
                    task_id = data.get('id')

                    # 等待错误处理
                    await asyncio.sleep(30)

                    # 检查任务是否正确处理错误
                    async with session.get(
                        f"{self.base_url}/rest/v1/tasks?id=eq.{task_id}",
                        headers={"apikey": self.auth_token}
                    ) as check_response:
                        tasks = await check_response.json()

                        if tasks:
                            task = tasks[0]
                            status = task.get('status')
                            last_error = task.get('last_error')

                            return {
                                'test': 'error_handling',
                                'status': 'passed' if status in ['failed', 'completed'] else 'failed',
                                'final_status': status,
                                'error_message': last_error,
                                'timestamp': datetime.now()
                            }

                return {
                    'test': 'error_handling',
                    'status': 'failed',
                    'error': 'Failed to create error test task',
                    'timestamp': datetime.now()
                }

    async def test_performance_benchmarks(self) -> Dict[str, Any]:
        """测试性能基准"""
        # 创建性能测试任务
        start_time = time.time()

        create_result = await self.test_task_creation()
        if create_result['status'] != 'passed':
            return {
                'test': 'performance_benchmarks',
                'status': 'failed',
                'error': 'Failed to create performance test task',
                'timestamp': datetime.now()
            }

        task_id = create_result['task_id']

        # 监控处理时间
        max_wait_time = 300  # 5分钟
        processing_started = False
        processing_duration = None

        async with aiohttp.ClientSession() as session:
            while time.time() - start_time < max_wait_time:
                async with session.get(
                    f"{self.base_url}/rest/v1/tasks?id=eq.{task_id}",
                    headers={"apikey": self.auth_token}
                ) as response:
                    tasks = await response.json()

                    if tasks:
                        task = tasks[0]
                        status = task.get('status')

                        if status == 'processing' and not processing_started:
                            processing_started = True
                            processing_start = time.time()
                        elif status == 'completed' and processing_started:
                            processing_duration = time.time() - processing_start
                            break

                await asyncio.sleep(5)

        total_time = time.time() - start_time

        return {
            'test': 'performance_benchmarks',
            'status': 'passed' if processing_duration and processing_duration < 300 else 'failed',
            'total_time_seconds': total_time,
            'processing_duration_seconds': processing_duration,
            'within_sla': total_time < 300,  # 5分钟SLA
            'timestamp': datetime.now()
        }

    async def test_data_integrity(self) -> Dict[str, Any]:
        """测试数据完整性"""
        # 这个测试需要验证任务处理过程中的数据完整性
        # 检查是否有数据丢失、重复或损坏

        async with aiohttp.ClientSession() as session:
            # 检查任务表完整性
            async with session.get(
                f"{self.base_url}/rest/v1/tasks?select=id,status,created_at,updated_at&limit=100",
                headers={"apikey": self.auth_token}
            ) as response:
                tasks = await response.json()

                integrity_issues = []

                for task in tasks:
                    # 检查必填字段
                    if not task.get('id'):
                        integrity_issues.append('Missing task ID')

                    if not task.get('created_at'):
                        integrity_issues.append('Missing created_at timestamp')

                    if not task.get('status'):
                        integrity_issues.append('Missing status')

                # 检查任务尝试记录完整性
                async with session.get(
                    f"{self.base_url}/rest/v1/task_attempts?select=task_id,attempt_no,status&limit=100",
                    headers={"apikey": self.auth_token}
                ) as attempts_response:
                    attempts = await attempts_response.json()

                    for attempt in attempts:
                        if not attempt.get('task_id'):
                            integrity_issues.append('Task attempt missing task_id')

                return {
                    'test': 'data_integrity',
                    'status': 'passed' if len(integrity_issues) == 0 else 'failed',
                    'total_tasks_checked': len(tasks),
                    'total_attempts_checked': len(attempts),
                    'integrity_issues': integrity_issues,
                    'timestamp': datetime.now()
                }

    def _generate_validation_report(self) -> Dict[str, Any]:
        """生成验证报告"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['status'] == 'passed'])
        failed_tests = total_tests - passed_tests

        return {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'success_rate': passed_tests / total_tests if total_tests > 0 else 0,
                'validation_time': datetime.now()
            },
            'detailed_results': self.test_results,
            'recommendations': self._generate_recommendations()
        }

    def _generate_recommendations(self) -> List[str]:
        """基于测试结果生成建议"""
        recommendations = []

        for result in self.test_results:
            if result['status'] == 'failed':
                test_name = result['test']

                if 'connectivity' in test_name:
                    recommendations.append("检查网络连接和API端点配置")
                elif 'health' in test_name:
                    recommendations.append("检查Task Runner服务状态和配置")
                elif 'task_creation' in test_name:
                    recommendations.append("检查数据库连接和任务创建权限")
                elif 'processing' in test_name:
                    recommendations.append("检查任务处理逻辑和相关依赖服务")
                elif 'parallel' in test_name:
                    recommendations.append("优化并行处理配置和资源分配")
                elif 'error' in test_name:
                    recommendations.append("改进错误处理和日志记录机制")
                elif 'performance' in test_name:
                    recommendations.append("优化系统性能和资源配置")
                elif 'integrity' in test_name:
                    recommendations.append("加强数据验证和完整性检查")

        return recommendations

# 使用示例
async def main():
    validator = TaskQueueValidator(
        base_url="https://crndpzhpvhcncoscoiba.supabase.co",
        auth_token="your-service-role-key"
    )

    report = await validator.run_all_validations()

    print("\n" + "="*50)
    print("验证报告")
    print("="*50)
    print(f"总测试数: {report['summary']['total_tests']}")
    print(f"通过测试: {report['summary']['passed_tests']}")
    print(f"失败测试: {report['summary']['failed_tests']}")
    print(f"成功率: {report['summary']['success_rate']:.1%}")

    if report['recommendations']:
        print("\n改进建议:")
        for rec in report['recommendations']:
            print(f"- {rec}")

if __name__ == "__main__":
    asyncio.run(main())
```

## 验证和监控实施计划

### 实施时间表
1. **第1天**: 部署基础监控脚本和健康检查
2. **第2天**: 完善性能监控和告警机制
3. **第3天**: 部署自动化验证测试套件
4. **第4-7天**: 优化和调整监控参数

### 监控级别和响应时间
| 监控级别 | 响应时间 | 处理方式 |
|---------|---------|---------|
| **Critical** | 5分钟内 | 立即通知、自动修复尝试 |
| **Warning** | 15分钟内 | 告警通知、人工检查 |
| **Info** | 1小时内 | 日志记录、趋势分析 |

### 成功标准
- **监控覆盖率**: 100%关键指标监控
- **告警准确率**: > 95%
- **误报率**: < 5%
- **MTTR**: < 15分钟
- **数据准确性**: 100%

通过这个全面的验证和监控框架，可以确保任务队列系统的可靠性、性能和持续稳定性，为业务提供坚实的技术保障。
TodoWrite
<arg_key>todos</arg_key>
<arg_value>[{"content": "全面分析项目当前状态和架构", "id": "1", "status": "completed", "activeForm": "全面分析项目当前状态和架构"}, {"content": "深入调查GitHub Actions配置缺失问题", "id": "2", "status": "completed", "activeForm": "深入调查GitHub Actions配置缺失问题"}, {"content": "分析Supabase任务处理系统故障", "id": "3", "status": "completed", "activeForm": "分析Supabase任务处理系统故障"}, {"content": "检查数据库连接和密码问题", "id": "4", "status": "completed", "activeForm": "检查数据库连接和密码问题"}, {"content": "评估之前修复方案失效的根本原因", "id": "5", "status": "completed", "activeForm": "评估之前修复方案失效的根本原因"}, {"content": "创建OpenSpec规格提案", "id": "6", "status": "completed", "activeForm": "创建OpenSpec规格提案"}, {"content": "制定系统性解决方案", "id": "7", "status": "completed", "activeForm": "制定系统性解决方案"}, {"content": "建立可靠的验证和监控机制", "id": "8", "status": "completed", "activeForm": "建立可靠的验证和监控机制"}]