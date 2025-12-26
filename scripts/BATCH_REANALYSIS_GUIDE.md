# 批量重新分析合同指南

## 📋 概述

本脚本用于批量重新分析合同库中的所有合同，使用新的立场感知分析提示词。

## 🎯 功能特性

- ✅ **立场感知分析**：支持甲方、乙方、中立三种分析视角
- ✅ **实时进度显示**：显示分析进度和状态
- ✅ **错误处理**：捕获并显示失败原因
- ✅ **成本估算**：预估API调用费用
- ✅ **交互式确认**：分析前需要用户确认

## 🚀 使用方法

### 方式1：PowerShell（Windows推荐）

```powershell
# 中立分析（默认）
.\scripts\batch-reanalysis.ps1

# 甲方立场分析
.\scripts\batch-reanalysis.ps1 party_a

# 乙方立场分析
.\scripts\batch-reanalysis.ps1 party_b
```

### 方式2：Node.js（跨平台）

```bash
# 中立分析（默认）
node scripts/batch-reanalysis.js

# 甲方立场分析
node scripts/batch-reanalysis.js party_a

# 乙方立场分析
node scripts/batch-reanalysis.js party_b
```

## 📊 当前合同库状态

根据数据库查询，当前有：

- **合同总数**：5个
- **条款总数**：349个
- **风险发现**：91个
- **缺少立场字段**：91个（100%需要重新分析）

### 合同列表

| # | 合同标题 | 条款数 | 风险数 | 状态 |
|---|---------|--------|--------|------|
| 1 | 经销合同 | 219 | 35 | uploaded |
| 2 | 经销商（线上）合作协议 | 15 | 26 | uploaded |
| 3 | 拼多多自营店合作协议 | 87 | 12 | uploaded |
| 4 | 销售合同 | 23 | 13 | uploaded |
| 5 | 大人广告合同 | 5 | 5 | uploaded |

## 💰 成本估算

**总Token数**：~14,524
**预估费用**：~$0.30（基于OpenRouter标准价格）

### 各合同成本明细

| 合同 | Token数 | 预估费用 |
|------|---------|---------|
| 经销合同 | 5,814 | $0.12 |
| 经销商（线上）合作协议 | 4,456 | $0.09 |
| 拼多多自营店合作协议 | 2,677 | $0.05 |
| 销售合同 | 1,475 | $0.03 |
| 大人广告合同 | 102 | $0.002 |

## ⚙️ 环境要求

- Node.js 18+
- PowerShell 7+（Windows）或 Bash（Linux/Mac）
- 有效的Supabase环境变量

### 环境变量配置

确保 `.env.production` 文件包含：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📝 执行步骤

### 步骤1：准备工作

```powershell
# 1. 确认当前在项目根目录
pwd

# 2. 检查环境变量
cat .env.production

# 3. 确认脚本存在
ls scripts/batch-reanalysis.*
```

### 步骤2：执行批量分析

```powershell
# 使用默认中立立场
.\scripts\batch-reanalysis.ps1

# 或指定立场
.\scripts\batch-reanalysis.ps1 party_a
```

### 步骤3：确认操作

脚本会显示合同列表并要求确认：

```
📋 合同列表：
   1. 经销合同 (版本 1)
   2. 经销商（线上）合作协议 (版本 1)
   3. 拼多多自营店合作协议 (版本 1)
   4. 销售合同 (版本 1)
   5. 大人广告合同 (版本 1)

是否继续分析这 5 个合同？(y/n):
```

输入 `y` 继续，或 `n` 取消。

### 步骤4：查看进度

```
⏳ 开始分析...

[1/5] ✅ 成功：经销合同
[2/5] ✅ 成功：经销商（线上）合作协议
[3/5] ✅ 成功：拼多多自营店合作协议
[4/5] ✅ 成功：销售合同
[5/5] ✅ 成功：大人广告合同
```

### 步骤5：查看结果

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 分析结果统计
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总计：5 个合同
✅ 成功：5 个
❌ 失败：0 个
📈 成功率：100.0%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔍 验证结果

### 方式1：访问前端页面

访问 https://still-legal-ai.gocdn.dpdns.org/risks 查看分析结果。

**检查项：**
- ✅ 摘要列是否正常显示
- ✅ 立场标签是否显示（🟢甲方/🔵乙方/⚪中立）
- ✅ 商业建议是否显示
- ✅ 谈判要点是否显示

### 方式2：查看数据库

```sql
-- 检查新字段填充情况
SELECT
  analysis_position,
  COUNT(*) as count
FROM risk_findings
GROUP BY analysis_position;

-- 应该看到：
-- party_a: XX条
-- party_b: XX条
-- neutral: XX条
```

### 方式3：查看Edge Function日志

访问 Supabase Dashboard → Edge Functions → Logs，查看执行日志。

## ⚠️ 故障排除

### 问题1：环境变量未加载

**错误：** `❌ 错误：缺少环境变量`

**解决方案：**
```powershell
# 1. 检查.env.production文件是否存在
ls .env.production

# 2. 确认文件包含必要的环境变量
cat .env.production | Select-String "SUPABASE"

# 3. 如果缺少，手动添加
Add-Content .env.production "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
Add-Content .env.production "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
```

### 问题2：API调用失败

**错误：** `❌ 失败：XXX合同 - 分析失败：401 Unauthorized`

**解决方案：**
- 检查 `SUPABASE_SERVICE_ROLE_KEY` 是否正确配置
- 确认Edge Function已部署：`supabase functions list`

### 问题3：部分合同失败

**错误：** 部分合同分析失败

**解决方案：**
- 查看失败原因
- 单独重新分析失败的合同
- 检查Supabase日志获取详细错误信息

## 🎯 立场选择建议

### 何时使用"甲方立场"（party_a）

如果您是合同的甲方（委托方、采购方、发包方），选择甲方立场会关注：
- ✅ 成本控制
- ✅ 质量保证
- ✅ 交付风险
- ✅ 知识产权保护
- ✅ 解约便利性

### 何时使用"乙方立场"（party_b）

如果您是合同的乙方（承包方、供应商、服务商），选择乙方立场会关注：
- ✅ 收款保障
- ✅ 责任限制
- ✅ 工作范围明确
- ✅ 合理定价机制
- ✅ 服务变更控制

### 何时使用"中立立场"（neutral）

如果您需要客观、平衡的分析，选择中立立场会关注：
- ✅ 权责平衡
- ✅ 法律合规性
- ✅ 争议解决机制
- ✅ 行业标准符合性
- ✅ 双方利益均衡

## 📚 相关文档

- [立场感知分析架构](./docs/POSITION_AWARE_ARCHITECTURE.md)
- [商业合同战略顾问提示词](./提示词.txt)
- [批量分析架构方案](./docs/BATCH_REANALYSIS_ARCHITECTURE.md)

## 💡 最佳实践

1. **从小到大测试**：先用1个小合同测试，确认效果后再批量处理
2. **选择合适立场**：根据合同类型选择最合适的分析立场
3. **分批次处理**：如果合同很多，建议分批次处理，避免一次性API调用过多
4. **监控成本**：关注API调用费用，设置合理的预算上限
5. **验证结果**：分析完成后立即验证结果，发现问题及时处理

## 🔄 后续优化

- [ ] 添加增量分析功能（只分析新增或修改的合同）
- [ ] 实现并行批处理（提高处理速度）
- [ ] 添加成本预警（当费用超过阈值时提示）
- [ ] 支持自定义提示词（用户可调整分析维度）
- [ ] 导出分析报告（PDF/Excel格式）

---

**文档版本**：1.0
**最后更新**：2025-12-26
**维护者**：Claude Code AI Agent
