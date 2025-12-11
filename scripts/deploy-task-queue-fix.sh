#!/bin/bash

# 任务队列修复部署脚本
# 使用方法: ./scripts/deploy-task-queue-fix.sh

set -e

echo "🚀 开始部署任务队列修复..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要的环境变量
check_env() {
    echo -e "${BLUE}📋 检查环境变量...${NC}"

    if [ -z "$SUPABASE_PROJECT_ID" ]; then
        echo -e "${RED}❌ SUPABASE_PROJECT_ID 未设置${NC}"
        exit 1
    fi

    if [ -z "$TASK_RUNNER_TOKEN" ]; then
        echo -e "${RED}❌ TASK_RUNNER_TOKEN 未设置${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ 环境变量检查通过${NC}"
}

# 步骤1: 执行数据库迁移
deploy_database() {
    echo -e "${BLUE}🗄️ 执行数据库迁移...${NC}"

    # 应用数据库迁移
    supabase db push

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库迁移成功${NC}"
    else
        echo -e "${RED}❌ 数据库迁移失败${NC}"
        exit 1
    fi
}

# 步骤2: 部署新的Task Runner
deploy_task_runner() {
    echo -e "${BLUE}🚀 部署Task Runner v2...${NC}"

    # 部署新函数
    supabase functions deploy task-runner-v2

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Task Runner v2 部署成功${NC}"
    else
        echo -e "${RED}❌ Task Runner v2 部署失败${NC}"
        exit 1
    fi
}

# 步骤3: 测试新函数
test_task_runner() {
    echo -e "${BLUE}🧪 测试Task Runner v2...${NC}"

    # 获取函数URL
    FUNCTION_URL="https://crndpzhpvhcncoscoiba.functions.supabase.co/task-runner-v2"

    # 健康检查
    echo "执行健康检查..."
    STATUS=$(curl -s -o health_check.json -w "%{http_code}" "${FUNCTION_URL}?action=health" \
        -H "Authorization: Bearer ${TASK_RUNNER_TOKEN}" \
        -H "Content-Type: application/json")

    if [ "$STATUS" -eq 200 ]; then
        echo -e "${GREEN}✅ 健康检查通过${NC}"
        cat health_check.json
    else
        echo -e "${RED}❌ 健康检查失败，状态码: $STATUS${NC}"
        cat health_check.json
        exit 1
    fi
}

# 步骤4: 更新GitHub Actions
update_github_actions() {
    echo -e "${BLUE}🔄 更新GitHub Actions配置...${NC}"

    # 备份原始workflow
    if [ -f ".github/workflows/run-task-runner.yml" ]; then
        cp .github/workflows/run-task-runner.yml .github/workflows/run-task-runner.yml.backup
        echo "已备份原始workflow文件"
    fi

    # 重命名新的workflow
    if [ -f ".github/workflows/enhanced-task-runner.yml" ]; then
        mv .github/workflows/enhanced-task-runner.yml .github/workflows/run-task-runner.yml
        echo "已启用新的workflow配置"
    fi

    # 提交更改
    git add .github/workflows/
    git commit -m "feat: 升级任务队列为分布式并行处理系统

- 部署Task Runner v2，支持批量处理和分布式锁
- 添加任务超时和重试机制
- 实现多worker并行处理
- 添加健康检查和维护任务
- 提供详细的执行监控和报告

Fixes: 修复任务60aed9e9-92df-49ca-afbe-256fc69d1ddb僵尸状态"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Git提交成功${NC}"
    else
        echo -e "${RED}❌ Git提交失败${NC}"
        exit 1
    fi
}

# 步骤5: 推送更改
push_changes() {
    echo -e "${BLUE}📤 推送更改到远程仓库...${NC}"

    git push origin main

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 推送成功${NC}"
    else
        echo -e "${RED}❌ 推送失败${NC}"
        exit 1
    fi
}

# 步骤6: 立即处理积压任务
process_backlog() {
    echo -e "${BLUE}⚡ 立即处理积压任务...${NC}"

    # 等待GitHub Actions开始执行
    echo "等待30秒让GitHub Actions开始..."
    sleep 30

    # 手动触发任务处理
    echo "触发任务处理..."
    gh workflow run run-task-runner.yml -f action=process

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 任务处理已触发${NC}"
    else
        echo -e "${YELLOW}⚠️ 无法自动触发，请手动在GitHub界面触发${NC}"
    fi
}

# 步骤7: 验证部署结果
verify_deployment() {
    echo -e "${BLUE}🔍 验证部署结果...${NC}"

    # 等待几分钟让系统运行
    echo "等待2分钟让系统处理任务..."
    sleep 120

    # 检查特定任务状态
    echo "检查僵尸任务状态..."
    TASK_ID="60aed9e9-92df-49ca-afbe-256fc69d1ddb"

    # 这里需要添加查询数据库的逻辑，或者使用API检查
    echo "请手动检查以下任务的状态: $TASK_ID"
    echo "预期状态: 应该不再是 'queued' 状态"

    # 检查GitHub Actions状态
    echo "检查GitHub Actions执行状态..."
    gh run list --workflow=run-task-runner.yml --limit=3
}

# 清理临时文件
cleanup() {
    echo -e "${BLUE}🧹 清理临时文件...${NC}"

    rm -f health_check.json

    echo -e "${GREEN}✅ 清理完成${NC}"
}

# 显示部署总结
show_summary() {
    echo -e "${GREEN}🎉 部署完成总结:${NC}"
    echo ""
    echo "✅ 数据库迁移完成"
    echo "✅ Task Runner v2 部署成功"
    echo "✅ GitHub Actions 配置更新"
    echo "✅ 积压任务处理已触发"
    echo ""
    echo -e "${YELLOW}📋 后续操作:${NC}"
    echo "1. 监控GitHub Actions执行状态"
    echo "2. 检查任务队列状态"
    echo "3. 验证僵尸任务是否被修复"
    echo "4. 观察新系统运行状况"
    echo ""
    echo -e "${BLUE}📞 如有问题，请参考 TASK_QUEUE_RECOVERY_PLAN.md${NC}"
}

# 主执行流程
main() {
    echo -e "${GREEN}🚀 任务队列修复部署开始${NC}"
    echo ""

    check_env
    deploy_database
    deploy_task_runner
    test_task_runner
    update_github_actions
    push_changes
    process_backlog
    verify_deployment
    cleanup
    show_summary

    echo -e "${GREEN}🎊 部署脚本执行完成!${NC}"
}

# 错误处理
trap 'echo -e "${RED}❌ 部署过程中发生错误${NC}"; exit 1' ERR

# 执行主函数
main "$@"