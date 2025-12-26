/**
 * 批量重新分析合同脚本
 *
 * 功能：
 * 1. 获取所有活跃合同
 * 2. 为每个合同触发风险分析（支持立场参数）
 * 3. 显示实时进度
 * 4. 统计成功/失败数量
 *
 * 使用方法：
 * node scripts/batch-reanalysis.js [position]
 *
 * 参数：
 * position - 可选，分析立场：party_a（甲方）| party_b（乙方）| neutral（中立，默认）
 *
 * 示例：
 * node scripts/batch-reanalysis.js neutral
 * node scripts/batch-reanalysis.js party_a
 * node scripts/batch-reanalysis.js party_b
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ 错误：缺少环境变量 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// 从命令行参数获取分析立场
const userPosition = process.argv[2] || 'neutral';
const validPositions = ['party_a', 'party_b', 'neutral'];

if (!validPositions.includes(userPosition)) {
  console.error(`❌ 错误：无效的立场参数 "${userPosition}"`);
  console.error('   有效值：party_a, party_b, neutral');
  process.exit(1);
}

const positionLabels = {
  party_a: '甲方',
  party_b: '乙方',
  neutral: '中立'
};

console.log(`\n🚀 开始批量重新分析合同（立场：${positionLabels[userPosition]}）\n`);

/**
 * 获取所有活跃合同
 */
async function getActiveContracts() {
  console.log('📊 获取活跃合同列表...');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/contracts`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`获取合同失败：${response.statusText}`);
  }

  const contracts = await response.json();

  // 获取每个合同的最新版本
  const contractsWithVersions = [];

  for (const contract of contracts) {
    const versionsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/contract_versions?contract_id=eq.${contract.id}&order=version_no.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (versionsResponse.ok) {
      const versions = await versionsResponse.json();
      if (versions.length > 0) {
        contractsWithVersions.push({
          ...contract,
          latestVersion: versions[0]
        });
      }
    }
  }

  return contractsWithVersions;
}

/**
 * 触发风险分析
 */
async function triggerAnalysis(contractId, contractVersionId, tenantId, position) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/risk-analyzer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      contract_version_id: contractVersionId,
      user_position: position
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`分析失败：${error}`);
  }

  return await response.json();
}

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 获取所有活跃合同
    const contracts = await getActiveContracts();

    if (contracts.length === 0) {
      console.log('✅ 没有需要重新分析的合同');
      return;
    }

    console.log(`✅ 找到 ${contracts.length} 个活跃合同\n`);

    // 2. 显示合同列表
    console.log('📋 合同列表：');
    contracts.forEach((contract, index) => {
      console.log(`   ${index + 1}. ${contract.title} (版本 ${contract.latestVersion.version_no})`);
    });
    console.log('');

    // 3. 确认是否继续
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question(`是否继续分析这 ${contracts.length} 个合同？(y/n): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('❌ 已取消');
      return;
    }

    console.log('\n⏳ 开始分析...\n');

    // 4. 逐个触发分析
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i];
      const progress = `[${i + 1}/${contracts.length}]`;

      try {
        process.stdout.write(`\r${progress} ⏳ 分析中：${contract.title.substring(0, 30)}...`);

        const result = await triggerAnalysis(
          contract.id,
          contract.latestVersion.id,
          contract.tenant_id,
          userPosition
        );

        successCount++;
        results.push({
          contract: contract.title,
          status: 'success',
          result
        });

        console.log(`\r${progress} ✅ 成功：${contract.title}`);

      } catch (error) {
        failCount++;
        results.push({
          contract: contract.title,
          status: 'failed',
          error: error.message
        });

        console.log(`\r${progress} ❌ 失败：${contract.title} - ${error.message}`);
      }

      // 避免API限流，每次请求间隔1秒
      if (i < contracts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 分析结果统计');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`总计：${contracts.length} 个合同`);
    console.log(`✅ 成功：${successCount} 个`);
    console.log(`❌ 失败：${failCount} 个`);
    console.log(`📈 成功率：${((successCount / contracts.length) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (failCount > 0) {
      console.log('\n❌ 失败详情：');
      results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`   • ${r.contract}: ${r.error}`);
        });
    }

    console.log('\n💡 提示：');
    console.log('   1. 分析是异步进行的，可能需要几分钟时间完成');
    console.log('   2. 您可以访问 /risks 页面查看分析进度');
    console.log('   3. 如需查看详细日志，请查看 Supabase Dashboard → Edge Functions → Logs');
    console.log('');

  } catch (error) {
    console.error('\n❌ 发生错误：', error.message);
    process.exit(1);
  }
}

// 运行主函数
main();
