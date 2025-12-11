#!/bin/bash

# Claude Flow 合同审查项目 - 快速启动脚本
# 使用方法: ./start-work.sh [模式]

MODE=${1:-"daily"}

echo "🚀 启动 Claude Flow 工作环境..."
echo "模式: $MODE"
echo "时间: $(date)"
echo "================================"

# 1. 检查系统状态
echo "📊 检查系统状态..."
claude-flow memory status --reasoningbank

echo ""
echo "🧠 查看项目信息..."

# 2. 根据模式执行不同操作
case $MODE in
    "daily")
        echo "📅 每日工作模式..."
        echo "📋 项目架构概览:"
        claude-flow memory query "项目架构" --namespace project --reasoningbank
        echo ""
        echo "🤖 核心代理信息:"
        claude-flow memory query "核心代理" --namespace agents --reasoningbank
        echo ""
        echo "📈 最近的工作记录:"
        claude-flow memory list --namespace daily --recent --reasoningbank
        ;;

    "optimize")
        echo "⚡ 性能优化模式..."
        echo "🔍 查看性能分析:"
        claude-flow memory query "性能" --namespace analysis --reasoningbank
        echo ""
        echo "💡 优化方案:"
        claude-flow memory query "优化" --namespace solutions --reasoningbank
        echo ""
        echo "📊 性能指标:"
        claude-flow memory query "指标" --namespace metrics --reasoningbank
        ;;

    "develop")
        echo "🛠️  开发模式..."
        echo "📋 技术决策:"
        claude-flow memory query "决策" --namespace decisions --reasoningbank
        echo ""
        echo "🐛 问题记录:"
        claude-flow memory query "问题" --namespace issues --reasoningbank
        echo ""
        echo "📝 用户反馈:"
        claude-flow memory query "反馈" --namespace feedback --reasoningbank
        ;;

    "review")
        echo "🔍 代码审查模式..."
        echo "📋 审查记录:"
        claude-flow memory query "审查" --namespace review --reasoningbank
        echo ""
        echo "🔒 安全检查:"
        claude-flow memory query "安全" --namespace security --reasoningbank
        ;;

    *)
        echo "❓ 未知模式: $MODE"
        echo "可用模式: daily, optimize, develop, review"
        exit 1
        ;;
esac

echo ""
echo "================================"
echo "✅ 系统状态检查完成"
echo ""
echo "🎯 快速命令:"
echo "  创建开发任务: claude-flow hive-mind spawn '你的任务' --claude"
echo "  存储信息: claude-flow memory store key '内容' --namespace daily --reasoningbank"
echo "  查询信息: claude-flow memory query '关键词' --namespace daily --reasoningbank"
echo "  查看帮助: cat CLAUDE_FLOW_GUIDE.md"
echo ""
echo "🚀 开始工作吧！"