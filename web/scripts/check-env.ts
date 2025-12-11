#!/usr/bin/env tsx

/**
 * 环境变量检查脚本
 * 用于验证认证相关的环境变量是否正确配置
 */

interface EnvCheckResult {
  name: string;
  required: boolean;
  present: boolean;
  value?: string;
  masked?: string;
}

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
] as const;

const optionalVars = [
  'NODE_ENV',
  'VERCEL_URL',
] as const;

function maskValue(value: string, name: string): string {
  if (name.includes('KEY') || name.includes('SECRET')) {
    return value.length > 8 ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}` : '***';
  }
  return value;
}

function checkEnvVar(name: string): EnvCheckResult {
  const value = process.env[name];
  const present = !!value;

  return {
    name,
    required: requiredVars.includes(name as any),
    present,
    value: present ? value : undefined,
    masked: present ? maskValue(value, name) : undefined,
  };
}

console.log('🔍 环境变量检查结果\n');

// 检查必需的环境变量
console.log('📋 必需环境变量:');
const requiredResults = requiredVars.map(checkEnvVar);
requiredResults.forEach(result => {
  const status = result.present ? '✅' : '❌';
  const value = result.masked || '未设置';
  console.log(`  ${status} ${result.name}: ${value}`);
});

// 检查可选的环境变量
console.log('\n📋 可选环境变量:');
const optionalResults = optionalVars.map(checkEnvVar);
optionalResults.forEach(result => {
  const status = result.present ? '✅' : '⚠️';
  const value = result.masked || result.value || '未设置';
  console.log(`  ${status} ${result.name}: ${value}`);
});

// 检查关键配置
console.log('\n🔧 配置检查:');

// 检查 Supabase URL 格式
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  try {
    new URL(supabaseUrl);
    console.log('  ✅ Supabase URL 格式正确');
  } catch {
    console.log('  ❌ Supabase URL 格式无效');
  }
} else {
  console.log('  ❌ Supabase URL 未设置');
}

// 检查 Site URL
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (siteUrl) {
  try {
    new URL(siteUrl);
    console.log('  ✅ Site URL 格式正确');
  } catch {
    console.log('  ❌ Site URL 格式无效');
  }
} else {
  console.log('  ⚠️ Site URL 未设置，将使用动态检测');
}

// 检查是否在 Vercel 环境
const isVercel = !!process.env.VERCEL_URL;
console.log(`  ${isVercel ? '✅' : '⚠️'} Vercel 环境: ${isVercel ? '是' : '否'}`);

if (isVercel) {
  const vercelUrl = `https://${process.env.VERCEL_URL}`;
  console.log(`  📍 Vercel URL: ${vercelUrl}`);
}

// 生成修复建议
console.log('\n💡 修复建议:');

const missingRequired = requiredResults.filter(r => !r.present);
if (missingRequired.length > 0) {
  console.log('  ❌ 缺少必需的环境变量:');
  missingRequired.forEach(r => {
    console.log(`    - ${r.name}`);
  });
  console.log('  请在 Vercel 控制台中添加这些环境变量');
} else {
  console.log('  ✅ 所有必需环境变量已设置');
}

if (!siteUrl && isVercel) {
  console.log('  💡 建议设置 NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app');
}

console.log('\n🚀 可以尝试的调试步骤:');
console.log('  1. 访问 /api/debug/auth 检查运行时配置');
console.log('  2. 检查浏览器控制台的错误信息');
console.log('  3. 验证邮件中的登录链接格式');
console.log('  4. 检查 Supabase 项目设置中的 Redirect URLs');

// 退出码
const missingCritical = missingRequired.filter(r =>
  r.name.includes('SUPABASE')
).length;

process.exit(missingCritical > 0 ? 1 : 0);