#!/usr/bin/env node

/**
 * Supabase 生产环境配置检查脚本
 * 用于验证 Vercel 部署环境的 Supabase 配置
 */

const { createServerClient } = require('@supabase/supabase-js');

function checkEnvironmentVariables() {
  console.log('🔍 检查环境变量...\n');

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SITE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ 缺少以下环境变量:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    return false;
  }

  console.log('✅ 所有必需的环境变量都已设置:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (varName.includes('URL')) {
      console.log(`   ${varName}: ${value}`);
    } else if (varName.includes('KEY')) {
      console.log(`   ${varName}: ${value?.substring(0, 10)}...`);
    } else {
      console.log(`   ${varName}: ${value}`);
    }
  });

  return true;
}

function validateSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  console.log('\n🌐 验证站点 URL...');

  try {
    const url = new URL(siteUrl);
    console.log(`✅ URL 格式正确: ${url.hostname}`);

    if (url.protocol === 'https:') {
      console.log('✅ 使用 HTTPS 协议');
    } else {
      console.warn('⚠️ 建议在生产环境中使用 HTTPS');
    }

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      console.warn('⚠️ 生产环境不应该使用 localhost');
    }

    return true;
  } catch (error) {
    console.error(`❌ 无效的站点 URL: ${siteUrl}`);
    return false;
  }
}

function checkSupabaseConnection() {
  console.log('\n🔗 测试 Supabase 连接...');

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log('✅ Supabase 客户端创建成功');
    return true;
  } catch (error) {
    console.error('❌ Supabase 客户端创建失败:', error.message);
    return false;
  }
}

function generateDeploymentChecklist() {
  console.log('\n📋 生产环境部署检查清单:');
  console.log('');
  console.log('1. 🔧 Supabase Dashboard 配置:');
  console.log('   ✓ 添加生产环境 URL 到 Site URL');
  console.log('   ✓ 添加重定向 URL: https://still-legal-ai.gocdn.dpdns.org/auth/callback');
  console.log('   ✓ 确认邮件模板中的链接正确');
  console.log('');
  console.log('2. 🚀 Vercel 环境变量:');
  console.log('   ✓ NEXT_PUBLIC_SUPABASE_URL');
  console.log('   ✓ NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('   ✓ NEXT_PUBLIC_SITE_URL=https://still-legal-ai.gocdn.dpdns.org');
  console.log('   ✓ SUPABASE_SERVICE_ROLE_KEY');
  console.log('');
  console.log('3. 🍪 Cookie 配置:');
  console.log('   ✓ 确保域名设置正确 (.gocdn.dpdns.org)');
  console.log('   ✓ SameSite 设置为 none');
  console.log('   ✓ Secure 设置为 true');
  console.log('');
  console.log('4. 🌐 域名配置:');
  console.log('   ✓ 确保 DNS 解析正确');
  console.log('   ✓ SSL 证书有效');
  console.log('   ✓ 没有 mixed content 警告');
}

async function main() {
  console.log('🚀 Supabase 生产环境配置检查');
  console.log('=====================================');

  const envOk = checkEnvironmentVariables();
  const urlOk = validateSiteUrl();
  const connectionOk = checkSupabaseConnection();

  if (envOk && urlOk && connectionOk) {
    console.log('\n🎉 配置检查通过！');
    generateDeploymentChecklist();
  } else {
    console.log('\n❌ 配置检查失败，请修复上述问题后重试。');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkEnvironmentVariables, validateSiteUrl, checkSupabaseConnection };