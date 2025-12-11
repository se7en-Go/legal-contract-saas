# Cloudflare代理规则配置指南

## 页面规则 (Page Rules)

### 1. 路径：`still-legal-ai.gocdn.dpdns.org/auth/callback*`
```
- SSL: Off (如果使用自定义证书)
- Browser Cache TTL: 0 (不缓存认证页面)
- Security Level: High (对于敏感操作)
- Automatic HTTPS Rewrites: On
```

### 2. 路径：`still-legal-ai.gocdn.dpdns.org/api/*`
```
- Cache Level: Bypass (绕过缓存)
- SSL: Off (确保与后端一致)
- Security Level: Medium
- Web Application Firewall: On
```

## 转换规则 (Transform Rules)

### 1. CORS Header Rule
```javascript
// Rule Name: Supabase CORS Headers
if (http.request.uri.path contains "/auth/" or http.request.uri.path contains "/api/") {
    set request.headers.origin = "https://still-legal-ai.gocdn.dpdns.org";
    set request.headers.referer = "https://still-legal-ai.gocdn.dpdns.org";
}
```

### 2. IP Header Rule
```javascript
// Rule Name: Preserve Client IP
set request.headers.x-forwarded-for = http.request.headers.cf-connecting-ip;
set request.headers.x-real-ip = http.request.headers.cf-connecting-ip;
```

## Origin Rules

### Supabase API 路由
```
Hostname: still-legal-ai.gocdn.dpdns.org
Path: /auth/v1/*
Override Origin:
  Host: your-project.supabase.co
  Port: 443
  Protocol: HTTPS
```

## 缓存规则

### Auth相关路径不缓存
```
- Path: /auth/*
- Cache: Bypass
- Browser Cache: No Cache
- Edge Cache TTL: 0
```

## 安全设置

### WAF规则
```
- Magic Link认证：允许
- Rate Limiting: 30 requests/minute per IP for /auth/* endpoints
- Bot Fight Mode: Off (用于开发测试)
```

### DDoS保护
```
- HTTP Flood Protection: Medium
- Advanced Protection: On
- Client Side Hardening: On
```

## SSL/TLS设置

```
- SSL/TLS mode: Full (strict)
- Minimum TLS version: 1.2
- Opportunistic Encryption: On
- TLS 1.3: Enabled
- HSTS: Enabled (max-age=63072000)
```