@echo off
chcp 65001 >nul
title 🔍 项目状态快速查看

echo 🔍 快速了解你的合同审查项目...
echo.

echo 📊 检查记忆系统状态:
claude-flow memory status --reasoningbank
echo.

echo 📋 项目基本信息:
claude-flow memory query "项目架构" --namespace project --reasoningbank
echo.

echo 🤖 核心代理团队:
claude-flow memory query "核心代理" --namespace agents --reasoningbank
echo.

echo 🎯 现在你可以开始工作了！
echo.
echo 💡 常用命令:
echo   • 布置任务: claude-flow swarm "要做的事情"
echo   • 存储信息: claude-flow memory store "重要信息" --namespace daily --reasoningbank
echo   • 查看信息: claude-flow memory query "关键词" --namespace daily --reasoningbank
echo.
pause