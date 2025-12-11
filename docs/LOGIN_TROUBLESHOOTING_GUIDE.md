# 登录认证故障排除指南

## 📋 目录

1. [快速诊断](#1-快速诊断)
2. [修复步骤](#2-修复步骤)
3. [验证测试](#3-验证测试)
4. [最佳实践](#4-最佳实践)
5. [故障排除](#5-故障排除)

---

## 1. 快速诊断

### 🔍 检查清单

#### 环境配置检查
```bash
# 1. 检查环境变量文件
cat .env.local
cat web/.env.local

# 2. 验证必要的变量
echo "NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY: $SUPABASE_SERVICE_ROLE_KEY"
```

**必要环境变量清单:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

#### Supabase 连接测试
```javascript
// 创建临时测试文件 web/test-supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Testing Supabase connection...')
console.log('URL:', supabaseUrl)
console.log('Key exists:', !!supabaseAnonKey)

const supabase = createClient(supabaseUrl, supabaseAnonKey)

supabase.from('profiles').select('count').then(result => {
  console.log('Connection result:', result)
}).catch(error => {
  console.error('Connection error:', error)
})
```

#### 运行测试
```bash
cd web
node test-supabase.js
```

### 🎯 常见问题识别

#### 问题类型 1: 环境变量缺失
**症状:**
- `TypeError: Cannot read property 'split' of undefined`
- URL 或 key 相关错误

**快速检查:**
```bash
# 检查所有 .env 文件
find . -name ".env*" -type f -exec echo "=== {} ===" \; -exec cat {} \;

# 检查 Next.js 配置
cat web/next.config.js
```

#### 问题类型 2: Supabase 项目配置错误
**症状:**
- URL 格式错误（包含 `/auth/v1` 路径）
- Key 长度异常
- CORS 错误

**验证步骤:**
```bash
# 检查 URL 格式
echo $NEXT_PUBLIC_SUPABASE_URL | grep -E "^https://[a-zA-Z0-9-]+\.supabase\.co$"

# 检查 key 长度
echo "ANON Key length: ${#NEXT_PUBLIC_SUPABASE_ANON_KEY}"
echo "Service Role Key length: ${#SUPABASE_SERVICE_ROLE_KEY}"
```

### 🛠️ 调试工具使用

#### 浏览器开发者工具
```javascript
// 在浏览器控制台中运行
console.log('Environment variables:')
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 检查 localStorage
console.log('Supabase auth item:', localStorage.getItem('supabase.auth.token'))

// 检查 URL 参数
console.log('Current URL params:', new URLSearchParams(window.location.search))
```

#### 网络请求监控
1. 打开开发者工具 → Network 标签
2. 尝试登录
3. 查找以下请求:
   - `https://[project-ref].supabase.co/auth/v1/token?grant_type=magiclink`
   - API 请求的认证头

---

## 2. 修复步骤

### 🔧 步骤 1: 修复环境变量配置

#### 创建正确的 .env.local 文件
```bash
# 在项目根目录创建 .env.local
cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
EOF

# 在 web 目录创建 .env.local
cat > web/.env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
EOF
```

#### 获取正确的 Supabase 配置
```bash
# 访问 Supabase Dashboard
# 1. 登录 https://supabase.com/dashboard
# 2. 选择你的项目
# 3. Settings → API
# 4. 复制以下信息:
#    - Project URL
#    - anon public key
#    - service_role key (谨慎使用)
```

### 🔧 步骤 2: 修复 Supabase 客户端初始化

#### 更新 `web/src/lib/supabase-server.ts`
```typescript
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 添加环境变量验证
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export function createClient() {
  const cookieStore = cookies()

  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', ...options })
      },
    },
    auth: {
      flowType: 'magiclink',
      debug: process.env.NODE_ENV === 'development'
    }
  })
}
```

#### 更新 `web/src/lib/supabase-client.ts`
```typescript
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { AuthError } from '@supabase/supabase-js'

// 添加环境变量检查
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  throw new Error('请检查环境变量配置')
}

export function createClient() {
  return createClientComponentClient({
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
    options: {
      auth: {
        flowType: 'magiclink',
        debug: process.env.NODE_ENV === 'development'
      }
    }
  })
}

export function isAuthError(error: any): error is AuthError {
  return error?.message !== undefined
}
```

### 🔧 步骤 3: 修复登录组件

#### 更新 `web/src/app/login/page.tsx`
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { isAuthError } from '@/lib/supabase-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createClient()

      // 验证邮箱格式
      if (!email || !email.includes('@')) {
        throw new Error('请输入有效的邮箱地址')
      }

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true
        }
      })

      if (signInError) {
        console.error('Sign in error:', signInError)

        // 提供更友好的错误信息
        if (signInError.message.includes('Invalid login')) {
          throw new Error('登录链接无效，请重新获取')
        } else if (signInError.message.includes('signup_disabled')) {
          throw new Error('用户注册已禁用，请联系管理员')
        } else {
          throw new Error(signInError.message)
        }
      }

      setMessage('登录链接已发送到您的邮箱，请查收')
      setEmail('')

    } catch (error) {
      console.error('Login error:', error)
      setError(error instanceof Error ? error.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            登录您的账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            使用无密码邮箱登录
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email-address" className="sr-only">
              邮箱地址
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? '发送中...' : '发送登录链接'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

### 🔧 步骤 4: 修复 API 路由

#### 更新 `web/src/app/api/session/route.ts`
```typescript
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Session error:', error)
      return NextResponse.json(
        { error: 'Failed to get session', details: error.message },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      )
    }

    // 获取用户信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, subscription:subscriptions(*)')
      .eq('id', session.user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile error:', profileError)
      return NextResponse.json(
        { error: 'Failed to get user profile', details: profileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      session,
      profile: profile || null
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
```

### 🔧 步骤 5: 部署验证

#### 本地测试
```bash
# 1. 启动开发服务器
cd web
npm run dev

# 2. 在新终端中测试
curl http://localhost:3000/api/session
```

#### 生产环境测试
```bash
# 1. 构建项目
cd web
npm run build

# 2. 本地预览
npm run start

# 3. 测试登录流程
curl http://localhost:3000/api/session
```

---

## 3. 验证测试

### 🧪 测试 1: 登录流程测试

#### 测试步骤
```bash
# 1. 启动应用
cd web && npm run dev

# 2. 访问登录页面
# http://localhost:3000/login

# 3. 输入测试邮箱
# test@example.com

# 4. 检查邮箱是否收到登录链接

# 5. 点击登录链接，验证是否正确跳转
```

#### 自动化测试脚本
```javascript
// web/test-login-flow.js
const puppeteer = require('puppeteer')

async function testLogin() {
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()

  try {
    // 监听网络请求
    page.on('request', request => {
      console.log('Request:', request.url())
    })

    page.on('response', response => {
      console.log('Response:', response.url(), response.status())
    })

    // 访问登录页面
    await page.goto('http://localhost:3000/login')
    await page.waitForSelector('input[type="email"]')

    // 填写邮箱
    await page.type('input[type="email"]', 'test@example.com')
    await page.click('button[type="submit"]')

    // 等待响应
    await page.waitForTimeout(2000)

    // 检查成功消息
    const successMessage = await page.$eval('.bg-green-50', el => el.textContent)
    console.log('Success message:', successMessage)

  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await browser.close()
  }
}

testLogin()
```

### 🧪 测试 2: 错误处理验证

#### 测试无效邮箱
```bash
# 测试各种无效邮箱格式
echo "Testing invalid emails..."

# 1. 空邮箱
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": ""}'

# 2. 无效格式
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}'

# 3. 不存在的邮箱
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@invalid.com"}'
```

#### 测试认证错误
```javascript
// web/test-auth-errors.js
import { createClient } from '@supabase/supabase-js'

async function testAuthErrors() {
  const supabase = createClient(
    'https://invalid-url.supabase.co',
    'invalid-key'
  )

  try {
    await supabase.auth.signInWithOtp({
      email: 'test@example.com'
    })
  } catch (error) {
    console.log('Expected error caught:', error.message)
  }

  // 测试有效的 URL 但无效的 key
  const supabase2 = createClient(
    'https://your-project-ref.supabase.co',
    'invalid-key'
  )

  try {
    await supabase2.auth.signInWithOtp({
      email: 'test@example.com'
    })
  } catch (error) {
    console.log('Auth error caught:', error.message)
  }
}

testAuthErrors()
```

### 🧪 测试 3: 多环境测试

#### 环境变量测试
```bash
# 创建测试脚本 web/test-environments.sh
#!/bin/bash

echo "Testing different environments..."

# 测试开发环境
NODE_ENV=development npm run dev &
DEV_PID=$!
sleep 5

# 测试会话 API
curl -s http://localhost:3000/api/session | jq '.'
kill $DEV_PID

# 测试生产环境
npm run build
npm run start &
PROD_PID=$!
sleep 5

# 测试会话 API
curl -s http://localhost:3000/api/session | jq '.'
kill $PROD_PID

echo "Environment tests completed"
```

---

## 4. 最佳实践

### 🔐 认证流程最佳实践

#### 1. 安全配置
```typescript
// web/src/lib/auth-security.ts
export const authConfig = {
  // 使用环境变量控制安全级别
  strictMode: process.env.NODE_ENV === 'production',

  // 密码策略
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },

  // 会话配置
  sessionConfig: {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 2, // 2 hours
  },

  // 魔法链接配置
  magicLinkConfig: {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    shouldCreateUser: process.env.ALLOW_SIGNUP === 'true',
    expiresIn: 60 * 10 // 10 minutes
  }
}
```

#### 2. 错误处理标准化
```typescript
// web/src/lib/error-handler.ts
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export const handleAuthError = (error: any): AuthError => {
  if (error?.message?.includes('Invalid login')) {
    return new AuthError('登录链接无效', 'INVALID_LOGIN', 401)
  }

  if (error?.message?.includes('signup_disabled')) {
    return new AuthError('用户注册已禁用', 'SIGNUP_DISABLED', 403)
  }

  if (error?.message?.includes('Email not confirmed')) {
    return new AuthError('请先确认您的邮箱', 'EMAIL_NOT_CONFIRMED', 403)
  }

  return new AuthError(
    error?.message || '认证失败',
    'UNKNOWN_ERROR',
    500
  )
}
```

#### 3. 会话管理
```typescript
// web/src/lib/session-manager.ts
import { createClient } from './supabase-client'

export class SessionManager {
  private supabase = createClient()

  async getCurrentSession() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession()

      if (error) {
        throw handleAuthError(error)
      }

      return session
    } catch (error) {
      console.error('Session retrieval failed:', error)
      return null
    }
  }

  async refreshSession() {
    try {
      const { data: { session }, error } = await this.supabase.auth.refreshSession()

      if (error) {
        throw handleAuthError(error)
      }

      return session
    } catch (error) {
      console.error('Session refresh failed:', error)
      return null
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut()

      if (error) {
        throw handleAuthError(error)
      }

      return true
    } catch (error) {
      console.error('Sign out failed:', error)
      return false
    }
  }
}
```

### 🛡️ 错误处理最佳实践

#### 1. 全局错误边界
```typescript
// web/src/components/ErrorBoundary.tsx
'use client'

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)

    // 发送错误到监控服务
    if (process.env.NODE_ENV === 'production') {
      // 发送到 Sentry 或其他错误监控服务
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              出现了一些问题
            </h1>
            <p className="text-gray-600 mb-6">
              {process.env.NODE_ENV === 'development'
                ? this.state.error?.message
                : '请刷新页面重试，如果问题持续存在请联系技术支持。'
              }
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

#### 2. API 错误处理中间件
```typescript
// web/src/lib/api-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { handleAuthError } from './error-handler'

export function withErrorHandler(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req)
    } catch (error) {
      console.error('API Error:', error)

      if (error instanceof Error && error.name === 'AuthError') {
        return NextResponse.json(
          {
            error: error.message,
            code: (error as any).code,
            timestamp: new Date().toISOString()
          },
          { status: (error as any).statusCode || 500 }
        )
      }

      return NextResponse.json(
        {
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
  }
}
```

### 🔧 调试最佳实践

#### 1. 开发环境调试工具
```typescript
// web/src/lib/debug-tools.ts
export const debugAuth = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth Debug]', ...args)
    }
  },

  error: (...args: any[]) => {
    console.error('[Auth Error]', ...args)

    // 开发环境下显示详细错误
    if (process.env.NODE_ENV === 'development') {
      console.trace('Stack trace:')
    }
  },

  logSession: (session: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Session Debug]', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiresAt: session?.expires_at
      })
    }
  },

  logEnvironment: () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Environment Debug]', {
        NODE_ENV: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL
      })
    }
  }
}
```

#### 2. 性能监控
```typescript
// web/src/lib/performance-monitor.ts
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map()

  static startTimer(name: string) {
    this.timers.set(name, Date.now())
  }

  static endTimer(name: string): number {
    const startTime = this.timers.get(name)
    if (!startTime) return 0

    const duration = Date.now() - startTime
    this.timers.delete(name)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${duration}ms`)
    }

    return duration
  }

  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.startTimer(name)
    try {
      const result = await fn()
      this.endTimer(name)
      return result
    } catch (error) {
      this.endTimer(name)
      throw error
    }
  }
}
```

---

## 5. 故障排除

### 🚨 常见错误及解决方案

#### 错误 1: "Missing environment variables"
**错误信息:**
```
Error: Missing Supabase environment variables
TypeError: Cannot read property 'split' of undefined
```

**解决方案:**
```bash
# 1. 检查 .env.local 文件是否存在
ls -la .env.local web/.env.local

# 2. 验证环境变量
cat .env.local | grep NEXT_PUBLIC_SUPABASE

# 3. 重新创建环境变量文件
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# 4. 重启开发服务器
npm run dev
```

#### 错误 2: "Invalid login credentials"
**错误信息:**
```
AuthApiError: Invalid login credentials
```

**解决方案:**
```typescript
// 检查 URL 格式
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (url && !url.includes('/auth/v1')) {
  console.log('URL format is correct')
}

// 检查 key 格式
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (key && key.startsWith('eyJ')) {
  console.log('Key format appears correct')
}

// 测试连接
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)
supabase.from('_test_connection').select('*').limit(1).then(result => {
  console.log('Connection test result:', result)
})
```

#### 错误 3: "Magic link is invalid or has expired" ✅ **已解决**
**错误信息:**
```
登录链接已失效或已被使用，请重新请求
AuthApiError: Magic link is invalid or has expired
```

**根本原因:**
1. 环境变量中包含隐藏的换行符（`\n`）
2. Cookie 配置不一致导致跨域问题

**已实施的解决方案:**
```typescript
// 1. 清理环境变量中的换行符
const cleanSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/[\n\r]/g, '');
const cleanSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/[\n\r]/g, '');

// 2. 统一 Cookie 配置为 sameSite: 'lax'
cookieOptions.sameSite = 'lax';

// 3. 使用环境变量构建重定向 URL
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/[\n\r]/g, '') || requestUrl.origin;
```

**验证方法:**
```bash
# 检查环境变量是否包含换行符
echo "$NEXT_PUBLIC_SUPABASE_URL" | hexdump -C

# 测试认证流程
curl https://your-domain.com/api/debug/supabase
```

#### 错误 4: "CORS policy error"
**错误信息:**
```
Access to fetch at 'https://your-project-ref.supabase.co/auth/v1/...'
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**解决方案:**
```bash
# 1. 在 Supabase Dashboard 中配置 CORS
# Settings → API → CORS
# 添加: http://localhost:3000, https://yourdomain.com

# 2. 检查预检请求
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, apikey" \
  https://your-project-ref.supabase.co/auth/v1/token
```

### 🔍 调试技巧

#### 1. 使用浏览器开发者工具
```javascript
// 在控制台中运行以下代码进行调试

// 检查当前会话
const { data: { session } } = await supabase.auth.getSession()
console.log('Current session:', session)

// 检查用户信息
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)

// 监听认证状态变化
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session)
})
```

#### 2. 网络请求分析
```bash
# 使用 curl 测试 API 端点
curl -X GET \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://your-project-ref.supabase.co/auth/v1/user

# 测试魔法链接发送
curl -X POST \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "options": {
      "emailRedirectTo": "http://localhost:3000/auth/callback"
    }
  }' \
  https://your-project-ref.supabase.co/auth/v1/otp
```

#### 3. 日志分析
```typescript
// 添加详细的日志记录
export const logger = {
  auth: {
    loginAttempt: (email: string) => {
      console.log(`[AUTH] Login attempt: ${email}`)
    },
    loginSuccess: (email: string) => {
      console.log(`[AUTH] Login success: ${email}`)
    },
    loginError: (email: string, error: any) => {
      console.error(`[AUTH] Login error: ${email}`, error)
    },
    sessionExpired: (userId: string) => {
      console.log(`[AUTH] Session expired: ${userId}`)
    }
  },
  api: {
    request: (method: string, url: string) => {
      console.log(`[API] ${method} ${url}`)
    },
    response: (status: number, duration: number) => {
      console.log(`[API] Response: ${status} (${duration}ms)`)
    },
    error: (error: any) => {
      console.error(`[API] Error:`, error)
    }
  }
}
```

### 📊 监控和维护

#### 1. 健康检查端点
```typescript
// web/src/app/api/health/route.ts
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase: 'unknown',
      authentication: 'unknown'
    }
  }

  try {
    // 测试 Supabase 连接
    const supabase = createClient()
    const { error } = await supabase.from('profiles').select('count').limit(1)

    health.services.supabase = error ? 'error' : 'ok'

    // 测试认证服务
    const { data: { session } } = await supabase.auth.getSession()
    health.services.authentication = session ? 'authenticated' : 'available'

    if (error) {
      health.status = 'degraded'
    }
  } catch (error) {
    health.status = 'error'
    health.services.supabase = 'error'
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  return NextResponse.json(health, { status: statusCode })
}
```

#### 2. 定期维护脚本
```bash
#!/bin/bash
# scripts/maintenance.sh

echo "🔍 Running system health check..."

# 检查环境变量
echo "Checking environment variables..."
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL is not set"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set"
  exit 1
fi

echo "✅ Environment variables are set"

# 测试 Supabase 连接
echo "Testing Supabase connection..."
curl -s -f "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Supabase connection is working"
else
  echo "❌ Supabase connection failed"
  exit 1
fi

# 检查健康端点
echo "Checking application health..."
curl -s -f "http://localhost:3000/api/health" > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Application is healthy"
else
  echo "❌ Application health check failed"
  exit 1
fi

echo "🎉 All checks passed!"
```

---

## 📞 获取帮助

如果以上解决方案都无法解决您的问题，请：

1. **收集诊断信息**
```bash
# 运行诊断脚本
curl -s https://raw.githubusercontent.com/your-repo/diagnose.sh | bash
```

2. **检查日志**
```bash
# 查看应用日志
npm run dev 2>&1 | tee app.log

# 查看 Supabase 日志
# Supabase Dashboard → Settings → Logs
```

3. **联系技术支持**
- 准备错误信息截图
- 提供详细的复现步骤
- 包含环境信息（操作系统、浏览器版本等）

---

## 📚 相关文档

- [Supabase Auth 官方文档](https://supabase.com/docs/guides/auth)
- [Next.js Auth 文档](https://nextjs.org/docs/authentication)
- [项目开发指南](./development-guide.md)
- [API 文档](../README.md)

---

*最后更新: 2025-12-01*
*版本: 1.0*