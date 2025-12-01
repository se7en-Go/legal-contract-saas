# 🌐 Vercel 环境变量配置指南

## 🔑 必需的环境变量

### Supabase 配置
```bash
# 从 Supabase Dashboard > Settings > API 获取
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 从 Supabase Dashboard > Settings > API > service_role 获取
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 应用配置
```bash
# Vercel 自动提供的环境变量
NEXT_PUBLIC_SITE_URL=https://your-app-name.vercel.app

# Supabase Storage 配置
CONTRACTS_BUCKET=contracts
```

### Supabase Edge Functions Tokens
```bash
# 用于调用 Insight Reporter 函数
INSIGHT_REPORTER_TOKEN=your_secure_random_string

# 用于调用 Key Clause Extractor 函数
KEY_CLAUSE_EXTRACTOR_TOKEN=your_secure_random_string

# 用于调用 Regulation Sync 函数
REGULATION_SYNC_TOKEN=your_secure_random_string

# 用于调用 Notification Dispatch 函数
NOTIFICATION_DISPATCH_TOKEN=your_secure_random_string
```

## 🔧 配置步骤

### 1. Vercel Dashboard 配置
1. 访问 [vercel.com](https://vercel.com)
2. 进入你的项目 Dashboard
3. 点击 `Settings` → `Environment Variables`
4. 添加上述所有环境变量

### 2. 生成安全 Token
```bash
# 使用 OpenSSL 生成安全随机字符串
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Supabase CORS 配置
在 Supabase Dashboard 中：
1. 进入 `Settings` → `API`
2. 在 `Additional Origins` 中添加：
   - `https://your-app-name.vercel.app`
   - `http://localhost:3000` (开发环境)

## 🚀 部署验证

部署完成后，验证以下功能：
- ✅ 用户登录/注册
- ✅ 合同上传功能
- ✅ AI 分析功能
- ✅ 实时数据更新
- ✅ 响应式设计