'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export default function AuthDebugPage() {
  const [session, setSession] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [cookieInfo, setCookieInfo] = useState<string[]>([]);

  useEffect(() => {
    // 调试信息收集
    const collectDebugInfo = () => {
      const info = {
        userAgent: navigator.userAgent,
        hostname: window.location.hostname,
        href: window.location.href,
        protocol: window.location.protocol,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        cookies: document.cookie.split(';').map(c => c.trim()),
        timestamp: new Date().toISOString()
      };
      setDebugInfo(info);
      setCookieInfo(document.cookie.split(';').map(c => c.trim()));
    };

    collectDebugInfo();

    // 检查当前会话
    const checkSession = async () => {
      try {
        const supabase = createBrowserSupabase();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session check error:', error);
        }

        setSession(session);

        // 获取用户信息
        if (session) {
          const { data: { user } } = await supabase.auth.getUser();
          console.log('Current user:', user);
        }
      } catch (error) {
        console.error('Debug session check failed:', error);
      }
    };

    checkSession();
  }, []);

  const testSignIn = async () => {
    try {
      const supabase = createBrowserSupabase();

      // 测试邮件OTP登录
      const { error } = await supabase.auth.signInWithOtp({
        email: 'test@example.com',
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('Test sign in error:', error);
        alert(`登录测试失败: ${error.message}`);
      } else {
        alert('测试邮件已发送（模拟）');
      }
    } catch (error) {
      console.error('Test sign in failed:', error);
      alert('登录测试异常');
    }
  };

  const testSignOut = async () => {
    try {
      const supabase = createBrowserSupabase();
      await supabase.auth.signOut();
      setSession(null);
      window.location.reload();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white mb-6">Supabase 认证诊断工具</h1>

      {/* 认证状态 */}
      <div className="surface-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-white mb-4">认证状态</h2>
        <div className="space-y-2 text-sm">
          <p className="text-slate-300">
            登录状态: <span className={session ? "text-green-400" : "text-red-400"}>
              {session ? "已登录" : "未登录"}
            </span>
          </p>
          {session && (
            <div className="text-slate-300 space-y-1">
              <p>用户ID: {session.user?.id}</p>
              <p>邮箱: {session.user?.email}</p>
              <p>Token 过期时间: {new Date(session.expires_at! * 1000).toLocaleString()}</p>
            </div>
          )}
        </div>
        <div className="mt-4 space-x-4">
          <button
            onClick={testSignIn}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
          >
            测试登录
          </button>
          {session && (
            <button
              onClick={testSignOut}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              退出登录
            </button>
          )}
        </div>
      </div>

      {/* Cookie 信息 */}
      <div className="surface-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Cookie 信息</h2>
        <div className="space-y-2">
          {cookieInfo.length > 0 ? (
            cookieInfo.map((cookie, index) => (
              <p key={index} className="text-sm text-slate-300 font-mono">
                {cookie}
              </p>
            ))
          ) : (
            <p className="text-sm text-slate-400">无 Cookie</p>
          )}
        </div>
      </div>

      {/* 环境信息 */}
      {debugInfo && (
        <div className="surface-card p-6 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">环境信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">主机名:</p>
              <p className="text-white font-mono">{debugInfo.hostname}</p>
            </div>
            <div>
              <p className="text-slate-400">协议:</p>
              <p className="text-white font-mono">{debugInfo.protocol}</p>
            </div>
            <div>
              <p className="text-slate-400">来源:</p>
              <p className="text-white font-mono">{debugInfo.origin}</p>
            </div>
            <div>
              <p className="text-slate-400">路径:</p>
              <p className="text-white font-mono">{debugInfo.pathname}</p>
            </div>
            <div>
              <p className="text-slate-400">搜索参数:</p>
              <p className="text-white font-mono">{debugInfo.search || '无'}</p>
            </div>
            <div>
              <p className="text-slate-400">Hash:</p>
              <p className="text-white font-mono">{debugInfo.hash || '无'}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-slate-400 mb-2">LocalStorage 键:</p>
            <div className="flex flex-wrap gap-2">
              {debugInfo.localStorage.map((key: string) => (
                <span key={key} className="px-2 py-1 bg-slate-700 text-white rounded text-xs">
                  {key}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-slate-400 mb-2">SessionStorage 键:</p>
            <div className="flex flex-wrap gap-2">
              {debugInfo.sessionStorage.map((key: string) => (
                <span key={key} className="px-2 py-1 bg-slate-700 text-white rounded text-xs">
                  {key}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 控制台日志提示 */}
      <div className="surface-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-white mb-4">调试提示</h2>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• 打开浏览器开发者工具查看详细日志</li>
          <li>• 在 Console 标签中查找 Supabase 相关信息</li>
          <li>• 在 Network 标签中检查认证请求</li>
          <li>• 在 Application 标签中查看 Cookie 和 LocalStorage</li>
        </ul>
      </div>
    </div>
  );
}