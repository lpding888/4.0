# Product Planner Skill - 工作流程(FLOW)

本文件描述标准工作流程(10 步),并附带每步输出要点。

## 总览流程

接收需求 → 澄清商业目标 → 澄清技术边界 → 澄清验收口径 → 深度分析 → 拆分任务卡 → 生成AI提示词 → 审查依赖与优先级 → 输出完整规划(10部分) → 分发任务卡 & 事件驱动协作

## 1) 接收用户需求

做什么:接收老板的自然语言描述与约束(时间/预算/合规)
为什么:建立"问题空间"初版
怎么做:将原始需求归档为 inbox/requests/YYYYMMDD-HHMM.md,记录上下文

输出示例:
```yaml
request:
  text: "做一个CMS配置系统,4周可演示,预算1500美元。"
  constraints:
    budgetUSD: 1500
    deadlineWeeks: 4
```

## 2) 第1阶段澄清:商业目标(3–5问)

聚焦 KPI、目标用户、范围优先级、预算
产物:clarifications.yaml 初稿(Q1–Q3)

## 3) 第2阶段澄清:技术边界(2–3问)

栈约定、第三方与合规、复用资产
产物:clarifications.yaml 增补(Q4–Q6)

## 4) 第3阶段澄清:验收口径(2–3问)

演示路径、UT/E2E 门槛、RBAC/审计是否纳入 MVP
若未答复:登记默认假设(Assumption Register)
产物:clarifications.yaml 定稿(含 assumptions)

## 5) 深度分析

痛点:为何做、谁受益、现有解决方案不足
价值:节省人力、加速试错、易扩展
技术选型:自研/第三方/混合的利弊与选择依据
架构:后端/前端/SCF/事件/鉴权/监控
风险:需求膨胀、性能瓶颈、安全/合规、成本失控
产物:product_spec.md 的 1–7 部分草案

## 6) 拆分任务卡(按部门,4–12h/卡)

先列 P0 必须项,再列 P1/P2
明确依赖与 needsCoordination
产物:tasks/CMS-*-*.json 文件集

## 7) 生成 AI 提示词(每卡)

aiPromptSuggestion.system:角色设定、质量门槛、栈约束
aiPromptSuggestion.user:具体指令、交付物、注意事项
产物:内嵌到每张任务卡

## 8) 审查依赖与优先级

检查:
- 粒度(4–12h)
- 依赖(不存在环)
- 部门分组正确
- 协作契约齐全
- P0 先行
产物:review/plan-check.md

## 9) 输出完整规划(10部分)

将 1–8 步产物整合到 deliverables/product-plan/
产出:product_spec.md(10部分)、timeline.md、handoff.md

## 10) 分发任务卡 & 事件驱动协作

将卡片推送至各部门队列;同时建立事件订阅
Backend/Frontend/SCF 开始并行执行,通过契约+事件协作
Reviewer/QA/Billing Guard 按门禁策略介入
产物:事件驱动的并行执行开始

## 关键检查点

阶段1(需求澄清):是否≤8个关键问题?是否记录默认假设?
阶段2(深度分析):是否覆盖痛点/价值/选型/架构/风险?
阶段3(任务拆解):是否控制粒度4-12h?是否标注依赖?
阶段4(AI提示词):是否500-1000字?是否包含system/user双阶段?
阶段5(依赖审查):是否无环?是否P0先行?
阶段6(完整规划):是否10部分完整?
阶段7(事件驱动):是否建立契约+事件订阅?

以上流程确保规划质量,可重复执行!
