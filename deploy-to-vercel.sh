#!/bin/bash

# 🚀 Next.js + Supabase 项目一键部署到 Vercel

echo "🚀 开始部署到 Vercel..."

# 检查是否已安装 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "📦 安装 Vercel CLI..."
    npm install -g vercel
fi

# 进入前端目录
cd web

# 检查环境变量
if [ ! -f ".env.local" ]; then
    echo "❌ 错误：未找到 .env.local 文件"
    echo "📝 请先创建 .env.local 文件并配置以下变量："
    echo "   NEXT_PUBLIC_SUPABASE_URL="
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY="
    echo "   SUPABASE_SERVICE_ROLE_KEY="
    echo "   CONTRACTS_BUCKET=contracts"
    echo "   NEXT_PUBLIC_SITE_URL="
    echo "   INSIGHT_REPORTER_TOKEN="
    echo "   KEY_CLAUSE_EXTRACTOR_TOKEN="
    echo "   REGULATION_SYNC_TOKEN="
    echo "   NOTIFICATION_DISPATCH_TOKEN="
    exit 1
fi

# 构建项目
echo "🔨 构建项目..."
npm run build

# 部署到 Vercel
echo "🌐 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo ""
echo "📋 部署后检查清单："
echo "   1️⃣ 在 Vercel Dashboard 配置环境变量"
echo "   2️⃣ 更新 Supabase CORS 设置"
echo "   3️⃣ 测试所有 API 端点"
echo "   4️⃣ 验证用户认证流程"