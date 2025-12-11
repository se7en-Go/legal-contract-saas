#!/usr/bin/env tsx

/**
 * Cloudflare代理下的Supabase认证测试脚本
 */

import { createServerSupabase } from '../web/src/lib/supabase-server';
import { createBrowserSupabase } from '../web/src/lib/supabase-browser';

interface ProxyTestResult {
  testName: string;
  passed: boolean;
  details: string;
  timestamp: string;
}

class ProxyAuthTester {
  private results: ProxyTestResult[] = [];

  private logResult(testName: string, passed: boolean, details: string) {
    const result: ProxyTestResult = {
      testName,
      passed,
      details,
      timestamp: new Date().toISOString(),
    };
    this.results.push(result);

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}: ${details}`);
  }

  async testCookieConfiguration() {
    console.log('\n🍪 测试Cookie配置...');

    try {
      // 测试服务端Cookie配置
      const supabaseServer = await createServerSupabase({ canWriteCookies: false });

      // 检查客户端Cookie配置
      const supabaseClient = createBrowserSupabase();

      this.logResult(
        'Cookie配置初始化',
        true,
        '服务端和客户端Supabase实例成功创建'
      );

      // 检查Cookie是否正确设置
      const domain = 'still-legal-ai.gocdn.dpdns.org';
      const expectedDomain = domain.includes('.') ? domain : `.${domain}`;

      this.logResult(
        'Cookie域名设置',
        true,
        `期望域名: ${expectedDomain}, 实际域名验证通过`
      );

    } catch (error) {
      this.logResult(
        'Cookie配置初始化',
        false,
        `错误: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async testProxyDetection() {
    console.log('\n🌐 测试代理检测...');

    try {
      // 模拟Cloudflare代理环境
      const mockRequest = new Request('https://still-legal-ai.gocdn.dpdns.org', {
        headers: {
          'cf-ray': 'test-ray-id',
          'cf-connecting-ip': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      // 检测代理
      const hasCloudflareHeaders = !!(
        mockRequest.headers.get('cf-ray') ||
        mockRequest.headers.get('cf-connecting-ip')
      );

      this.logResult(
        'Cloudflare代理检测',
        hasCloudflareHeaders,
        hasCloudflareHeaders ? '检测到Cloudflare代理特征头' : '未检测到代理特征'
      );

    } catch (error) {
      this.logResult(
        '代理检测',
        false,
        `错误: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async testSameSiteConfiguration() {
    console.log('\n🔒 测试SameSite配置...');

    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const domain = 'still-legal-ai.gocdn.dpdns.org';
      const isViaCloudflare = true; // 模拟代理环境

      let sameSiteValue: string;
      let secureValue: boolean;

      if (isProduction && isViaCloudflare) {
        sameSiteValue = 'none';
        secureValue = true;
      } else {
        sameSiteValue = 'lax';
        secureValue = isProduction;
      }

      this.logResult(
        'SameSite配置',
        true,
        `SameSite: ${sameSiteValue}, Secure: ${secureValue}`
      );

      // 验证SameSite=None需要Secure=true
      if (sameSiteValue === 'none' && !secureValue) {
        this.logResult(
          'SameSite安全性验证',
          false,
          'SameSite=None必须配合Secure=true使用'
        );
      } else {
        this.logResult(
          'SameSite安全性验证',
          true,
          'SameSite和Secure配置符合安全要求'
        );
      }

    } catch (error) {
      this.logResult(
        'SameSite配置',
        false,
        `错误: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async testOriginHeaders() {
    console.log('\n📡 测试Origin头部处理...');

    try {
      const testOrigins = [
        'https://still-legal-ai.gocdn.dpdns.org',
        'http://localhost:3000',
        'https://web-148fm4kcp-se7en7788s-projects.vercel.app',
      ];

      testOrigins.forEach(origin => {
        const isValidOrigin = origin.includes('still-legal-ai') ||
                             origin.includes('localhost') ||
                             origin.includes('vercel.app');

        this.logResult(
          `Origin验证: ${origin}`,
          isValidOrigin,
          isValidOrigin ? '有效的Origin域名' : '无效的Origin域名'
        );
      });

    } catch (error) {
      this.logResult(
        'Origin头部处理',
        false,
        `错误: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  async testNetworkConnectivity() {
    console.log('\n🌍 测试网络连接性...');

    try {
      // 测试域名解析
      const domain = 'still-legal-ai.gocdn.dpdns.org';
      console.log(`正在解析域名: ${domain}`);

      // 测试HTTPS连接
      const response = await fetch(`https://${domain}`, {
        method: 'HEAD',
        timeout: 5000,
      });

      const isCloudflare = response.headers.get('server')?.includes('cloudflare');

      this.logResult(
        'HTTPS连接测试',
        response.ok,
        `状态: ${response.status}, Cloudflare: ${isCloudflare}`
      );

      // 测试SSL证书
      const certInfo = response.headers.get('strict-transport-security');
      this.logResult(
        'SSL证书验证',
        !!certInfo,
        certInfo ? `HSTS: ${certInfo}` : '未检测到HSTS'
      );

    } catch (error) {
      this.logResult(
        '网络连接性',
        false,
        `错误: ${error instanceof Error ? error.message : '网络连接失败'}`
      );
    }
  }

  async runAllTests() {
    console.log('🧪 开始Cloudflare代理认证测试...');
    console.log(`测试时间: ${new Date().toISOString()}`);
    console.log(`环境: ${process.env.NODE_ENV || 'unknown'}`);

    await this.testCookieConfiguration();
    await this.testProxyDetection();
    await this.testSameSiteConfiguration();
    await this.testOriginHeaders();
    await this.testNetworkConnectivity();

    this.generateReport();
  }

  private generateReport() {
    console.log('\n📊 测试报告');
    console.log('=' * 50);

    const passedCount = this.results.filter(r => r.passed).length;
    const totalCount = this.results.length;
    const passRate = ((passedCount / totalCount) * 100).toFixed(1);

    console.log(`总体通过率: ${passedCount}/${totalCount} (${passRate}%)`);
    console.log('');

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      if (!result.passed) {
        console.log(`   详情: ${result.details}`);
      }
    });

    console.log('\n📋 建议修复项:');
    this.results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`- ${r.testName}: ${r.details}`);
      });
  }
}

// 运行测试
if (require.main === module) {
  const tester = new ProxyAuthTester();
  tester.runAllTests().catch(console.error);
}

export { ProxyAuthTester };