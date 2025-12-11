// 获取最新的Service Role Key
const { execSync } = require('child_process');

try {
  console.log('🔍 获取Supabase Service Role Key...');

  // 执行supabase status命令
  const output = execSync('supabase status --output json', { encoding: 'utf8', cwd: process.cwd() });
  const status = JSON.parse(output);

  if (status.service_role_key) {
    console.log('✅ 找到Service Role Key:');
    console.log('PROJECT_SERVICE_ROLE_KEY=' + status.service_role_key);
    console.log('TASK_RUNNER_TOKEN=' + status.service_role_key);
    console.log('\n📋 请复制上面的key到GitHub Actions secrets中');
  } else {
    console.error('❌ 未找到Service Role Key');
    console.log('请检查Supabase CLI配置');
  }
} catch (error) {
  console.error('❌ 获取token失败:', error.message);
  console.log('\n🔧 请手动在Supabase Dashboard中获取Service Role Key:');
  console.log('1. 访问: https://app.supabase.com/project/crndpzhpvhcncoscoiba/settings/api');
  console.log('2. 复制 service_role key');
}