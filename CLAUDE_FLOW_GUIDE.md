# 🚀 Claude Flow 实用指南 - 合同审查 SaaS 系统

## 📋 每次启动 Claude Code 后的标准流程

### 1️⃣ 快速开始 (5分钟内)

```bash
# 检查系统状态
claude-flow memory status --reasoningbank

# 快速回顾项目信息
claude-flow memory query "项目架构" --namespace project --reasoningbank
claude-flow memory query "核心代理" --namespace agents --reasoningbank

# 查看最近的记忆
claude-flow memory list --recent --reasoningbank
```

### 2️⃣ 日常工作流程

#### **场景1：开发新功能**
```bash
# 创建蜂群任务
claude-flow hive-mind spawn "开发合同模板推荐功能" --claude

# 或者使用简单swarm
claude-flow swarm "添加智能合同模板推荐系统" --claude
```

#### **场景2：性能优化**
```bash
# 查询之前的分析
claude-flow memory query "性能" --namespace analysis --reasoningbank

# 创建优化任务
claude-flow hive-mind spawn "优化数据库查询性能" --claude
```

#### **场景3：问题排查**
```bash
# 存储问题描述
claude-flow memory store issue_description "用户反馈合同上传缓慢" --namespace issues --reasoningbank

# 创建排查任务
claude-flow hive-mind spawn "排查合同上传缓慢问题" --claude
```

### 3️⃣ 记忆管理命令

#### **存储信息**
```bash
# 存储代码决策
claude-flow memory store decision_20241130 "选择使用pgvector进行合同语义搜索" --namespace decisions --reasoningbank

# 存储用户反馈
claude-flow memory store user_feedback "律师用户希望增加批量处理功能" --namespace feedback --reasoningbank

# 存储技术方案
claude-flow memory store tech_solution "实施Redis缓存降低LLM调用成本" --namespace solutions --reasoningbank
```

#### **查询信息**
```bash
# 查询所有决策
claude-flow memory query "决策" --namespace decisions --reasoningbank

# 查询用户反馈
claude-flow memory query "用户反馈" --namespace feedback --reasoningbank

# 查询技术方案
claude-flow memory query "技术方案" --namespace solutions --reasoningbank
```

### 4️⃣ 蜂群协作模式

#### **功能开发模式**
```bash
# 启动完整开发团队
claude-flow hive-mind spawn "开发合同版本对比功能" \
  --agents architect,senior-dev,junior-dev,qa,ui-designer \
  --claude
```

#### **问题解决模式**
```bash
# 启动问题排查团队
claude-flow hive-mind spawn "解决生产环境内存泄漏" \
  --agents debugger,performance-expert,sre,monitoring \
  --claude
```

#### **优化改进模式**
```bash
# 启动优化团队
claude-flow hive-mind spawn "优化OCR处理速度50%" \
  --agents performance-expert,ml-engineer,backend-dev,frontend-dev \
  --claude
```

### 5️⃣ 实用命令别名 (添加到 .bashrc 或 .zshrc)

```bash
# 快速查询项目信息
alias cf-info="claude-flow memory query '项目架构' --namespace project --reasoningbank"

# 快速查看记忆状态
alias cf-status="claude-flow memory status --reasoningbank"

# 快速创建开发任务
alias cf-dev="claude-flow hive-mind spawn"

# 快速存储决策
alias cf-decision="claude-flow memory store"

# 快速查询记忆
alias cf-query="claude-flow memory query"
```

### 6️⃣ 工作流程模板

#### **A. 日常开发流程**
```bash
# 1. 晨间检查 - 2分钟
claude-flow memory status --reasoningbank
claude-flow memory list --recent --reasoningbank

# 2. 创建今日任务
claude-flow memory store daily_focus "今日完成：1)用户认证优化 2)合同搜索改进" --namespace daily --reasoningbank

# 3. 启动开发团队
claude-flow hive-mind spawn "今日开发任务" --claude

# 4. 工作结束总结
claude-flow memory store daily_summary "完成功能X，遇到问题Y，明日计划Z" --namespace daily --reasoningbank
```

#### **B. 代码审查流程**
```bash
# 1. 存储审查目标
claude-flow memory store code_review_goal "审查risk-analyzer代理的优化代码" --namespace review --reasoningbank

# 2. 启动审查团队
claude-flow hive-mind spawn "代码质量审查和安全检查" \
  --agents senior-dev,security-expert,qatest,performance-expert \
  --claude

# 3. 存储审查结果
claude-flow memory store review_result "发现3个优化点，无安全问题" --namespace review --reasoningbank
```

#### **C. 性能优化流程**
```bash
# 1. 分析当前问题
claude-flow memory query "性能" --namespace analysis --reasoningbank

# 2. 创建优化任务
claude-flow hive-mind spawn "系统性能优化" --claude

# 3. 存储优化方案
claude-flow memory store optimization_plan "实施数据库索引和查询缓存" --namespace optimization --reasoningbank

# 4. 跟踪优化效果
claude-flow memory store performance_metrics "查询时间从2s降低到200ms" --namespace metrics --reasoningbank
```

### 7️⃣ 常用命名空间规范

```bash
# 命名空间使用规范
--namespace project      # 项目架构、技术栈、核心功能
--namespace agents       # 代理配置、能力描述、协作模式
--namespace decisions    # 技术决策、架构选择、工具选型
--namespace issues       # 问题记录、bug报告、故障分析
--namespace solutions    # 解决方案、优化建议、实施计划
--namespace feedback     # 用户反馈、需求变更、体验改进
--namespace daily        # 每日工作、任务计划、进度总结
--namespace optimization # 性能优化、代码改进、效率提升
--namespace metrics      # 性能指标、监控数据、统计信息
--namespace review       # 代码审查、质量检查、安全扫描
```

### 8️⃣ 高级技巧

#### **记忆搜索技巧**
```bash
# 模糊搜索
claude-flow memory query "数据库" --namespace all --reasoningbank

# 时间范围搜索
claude-flow memory list --namespace decisions --recent --reasoningbank

# 高匹配度搜索
claude-flow memory query "合同审查" --threshold 0.8 --reasoningbank
```

#### **批量操作**
```bash
# 批量存储相关信息
claude-flow memory store focus_areas "性能优化,用户体验,功能扩展" --namespace planning --reasoningbank
claude-flow memory store tech_debt "需要重构的模块:payment,notification" --namespace debt --reasoningbank
claude-flow memory store team_goals "Q4目标:提升处理速度50%" --namespace goals --reasoningbank
```

## 🎯 最佳实践建议

### **1. 记忆管理**
- 每天开始和结束时都要更新记忆
- 重要决策和方案必须存储
- 使用规范的命名空间
- 定期清理过期的记忆

### **2. 蜂群使用**
- 复杂任务使用 hive-mind，简单任务使用 swarm
- 合理配置代理类型和数量
- 充分利用代理的专业能力

### **3. 工作流程**
- 建立固定的日常工作流程
- 使用命令别名提高效率
- 定期查看和总结记忆内容

---

💡 **记住**：Claude Flow 最大的优势是**记忆积累**和**团队协作**。越用越聪明，积累的越多，工作效率越高！