# 认证问题排查指南

## 🚨 常见问题

### 1. 登录链接点击后没有反应或跳转到登录页面

**可能原因**:
- 环境变量配置不正确
- Cookie 设置问题
- 跨域问题
- Supabase 配置问题

**排查步骤**:

1. **检查环境变量**:
   ```bash
   npm run check-env
   ```

2. **检查运行时配置**:
   访问 `/api/debug/auth` 端点查看运行时配置

3. **检查浏览器控制台**:
   - 打开开发者工具
   - 查看 Console 和 Network 标签页
   - 注意错误信息

4. **验证登录链接**:
   - 确认邮件中的链接包含正确的域名
   - 检查链接中的 `code` 参数

### 2. "登录链接已失效或已被使用" 错误

**可能原因**:
- 登录链接已过期（Supabase 默认 1 小时）
- 链接已被使用
- 环境变量 `NEXT_PUBLIC_SUPABASE_URL` 不匹配

**解决方案**:
1. 重新请求登录邮件
2. 检查 Supabase 项目中的 Site URL 设置
3. 确保 `NEXT_PUBLIC_SUPABASE_URL` 与 Supabase 项目一致

### 3. Cookie 相关问题

**症状**:
- 登录成功但立即被登出
- 无法维持登录状态

**解决方案**:
1. 检查浏览器 Cookie 设置
2. 确保使用 HTTPS（生产环境）
3. 检查 Cookie 域名设置

## 🔧 配置检查清单

### Vercel 环境变量
确保在 Vercel 项目设置中配置了以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

### Supabase 项目设置
在 Supabase Dashboard > Settings > Authentication 中：

1. **Site URL**: 设置为你的应用域名
2. **Redirect URLs**: 添加以下 URLs:
   - `https://your-domain.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (本地开发)

### 本地开发环境
创建 `.env.local` 文件：
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🐛 调试步骤

### 1. 使用调试端点
访问 `/api/debug/auth` 获取详细的配置信息

### 2. 检查浏览器控制台
在开发者工具中查看:
- Console 标签页的错误和警告
- Network 标签页的请求失败
- Application 标签页的 Cookie 状态

### 3. 验证认证流程
1. 输入邮箱并请求登录链接
2. 检查收到的邮件链接格式
3. 点击链接时观察网络请求
4. 检查最终的重定向目标

### 4. 检查 Supabase 日志
在 Supabase Dashboard 中:
- 查看 Authentication 日志
- 检查 Database 日志
- 验证用户创建和会话状态

## 🔄 认证流程说明

1. **用户输入邮箱** → `POST /login` → Supabase 发送 OTP 邮件
2. **用户点击邮件链接** → `GET /?code=xxx` → 重定向到 `/auth/callback`
3. **处理 Code** → `exchangeCodeForSession` → 设置 Cookie
4. **重定向到首页** → 检查认证状态 → 重定向到 Dashboard

## 📞 获取帮助

如果以上步骤无法解决问题:

1. **收集错误信息**:
   - 浏览器控制台截图
   - 网络请求详情
   - `/api/debug/auth` 的输出

2. **检查 GitHub Issues**:
   查看是否有类似问题的报告

3. **联系支持**:
   提供详细的错误信息和复现步骤