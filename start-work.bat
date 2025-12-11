@echo off
chcp 65001 >nul
title 🚀 Claude Flow 工作环境启动器

echo 🚀 启动 Claude Flow 工作环境...
echo 时间: %date% %time%
echo ========================================

REM 检查参数
set MODE=daily
if not "%1"=="" set MODE=%1

echo 模式: %MODE%
echo.

REM 检查系统状态
echo 📊 检查系统状态...
claude-flow memory status --reasoningbank
echo.

echo 🧠 查看项目信息...

REM 根据模式执行不同操作
if "%MODE%"=="daily" goto :daily_mode
if "%MODE%"=="optimize" goto :optimize_mode
if "%MODE%"=="develop" goto :develop_mode
if "%MODE%"=="review" goto :review_mode
goto :unknown_mode

:daily_mode
echo 📅 每日工作模式...
echo.
echo 📋 项目架构概览:
claude-flow memory query "项目架构" --namespace project --reasoningbank
echo.
echo 🤖 核心代理信息:
claude-flow memory query "核心代理" --namespace agents --reasoningbank
echo.
echo 📈 最近的工作记录:
claude-flow memory list --namespace daily --recent --reasoningbank 2>nul
goto :end

:optimize_mode
echo ⚡ 性能优化模式...
echo.
echo 🔍 查看性能分析:
claude-flow memory query "性能" --namespace analysis --reasoningbank
echo.
echo 💡 优化方案:
claude-flow memory query "优化" --namespace solutions --reasoningbank
echo.
echo 📊 性能指标:
claude-flow memory query "指标" --namespace metrics --reasoningbank
goto :end

:develop_mode
echo 🛠️ 开发模式...
echo.
echo 📋 技术决策:
claude-flow memory query "决策" --namespace decisions --reasoningbank
echo.
echo 🐛 问题记录:
claude-flow memory query "问题" --namespace issues --reasoningbank
echo.
echo 📝 用户反馈:
claude-flow memory query "反馈" --namespace feedback --reasoningbank
goto :end

:review_mode
echo 🔍 代码审查模式...
echo.
echo 📋 审查记录:
claude-flow memory query "审查" --namespace review --reasoningbank
echo.
echo 🔒 安全检查:
claude-flow memory query "安全" --namespace security --reasoningbank
goto :end

:unknown_mode
echo ❓ 未知模式: %MODE%
echo 可用模式: daily, optimize, develop, review
goto :end

:end
echo.
echo ========================================
echo ✅ 系统状态检查完成
echo.
echo 🎯 快速命令:
echo   创建开发任务: claude-flow swarm "你的任务"
echo   存储信息: claude-flow memory store key "内容" --namespace daily --reasoningbank
echo   查询信息: claude-flow memory query "关键词" --namespace daily --reasoningbank
echo   查看帮助: type CLAUDE_FLOW_GUIDE.md
echo.
echo 🚀 开始工作吧！
pause