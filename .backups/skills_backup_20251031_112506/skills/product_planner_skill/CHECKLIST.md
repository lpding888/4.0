# Product Planner Skill - 自检清单(CHECKLIST)

在输出规划前,必须完成以下自检:

## 需求澄清阶段

- [ ] 是否完成三阶段澄清(商业目标/技术边界/验收口径)?
- [ ] 关键问题是否≤8个?
- [ ] 是否记录默认假设清单(若用户未答复)?
- [ ] 默认假设是否合理且有复核计划?

## 深度分析阶段

- [ ] 是否分析用户痛点与商业价值?
- [ ] 是否进行技术选型(自研/第三方/混合)?
- [ ] 是否设计系统架构(后端/前端/SCF/事件/鉴权)?
- [ ] 是否识别风险并提出应对策略?
- [ ] 是否联动Billing Guard做成本预估?

## 任务拆解阶段

- [ ] 是否按部门分组(Backend/Frontend/SCF/QA/Reviewer/Deploy)?
- [ ] 每个任务卡是否控制粒度(4-12小时)?
- [ ] 是否严格区分优先级(P0/P1/P2)?
- [ ] 是否标注依赖关系(dependencies)?
- [ ] 跨部门协作任务是否有needsCoordination?
- [ ] 是否产出协作契约(OpenAPI/UI/事件)?

## AI提示词阶段

- [ ] 每个任务卡是否有aiPromptSuggestion?
- [ ] aiPromptSuggestion是否包含system和user双阶段?
- [ ] aiPromptSuggestion是否500-1000字?
- [ ] 是否包含角色设定、质量门槛、具体指令?

## 质量门禁阶段

- [ ] 是否设置Reviewer门禁(requiresReviewer: true)?
- [ ] 是否设置QA门禁(requiresQA: true)?
- [ ] 是否设置Billing Guard预算门禁?
- [ ] 是否定义审查范围(安全/规范/架构/成本)?

## 时间与成本阶段

- [ ] 是否形成周级里程碑计划(Week1-4)?
- [ ] 是否标注可并行执行的任务?
- [ ] 是否预估总工时与成本?
- [ ] 是否识别关键路径与瓶颈?

## 完整规划输出

- [ ] 是否输出10部分完整规划(product_spec.md)?
- [ ] 是否输出任务卡文件集(tasks/*.json)?
- [ ] 是否输出时间线(timeline.md)?
- [ ] 是否输出交付口径(handoff.md)?
- [ ] 所有任务卡是否包含完整18个字段?

## 任务卡字段检查

每个任务卡必须包含以下18个字段:
- [ ] taskId - 任务唯一标识
- [ ] projectId - 项目标识
- [ ] module - 模块名称
- [ ] title - 任务标题
- [ ] department - 部门(Backend/Frontend/SCF/QA/Reviewer/Deploy)
- [ ] phase - 阶段(MVP/Beta/GA)
- [ ] priority - 优先级(P0/P1/P2)
- [ ] estimatedHours - 预估工时(4-12小时)
- [ ] dependencies - 依赖任务ID列表
- [ ] description - 任务描述
- [ ] technicalRequirements - 技术要求
- [ ] acceptanceCriteria - 验收标准(至少2条)
- [ ] deliverables - 交付物清单
- [ ] needsCoordination - 跨部门协作需求
- [ ] aiPromptSuggestion - AI提示词(system+user)
- [ ] reviewPolicy - 审查策略
- [ ] qaPolicy - QA策略
- [ ] status - 状态(Ready/InProgress/Completed)

## 协作契约检查

- [ ] 前后端协作是否有OpenAPI契约?
- [ ] 前端开发是否有UI原型?
- [ ] 异步任务是否有事件契约?
- [ ] 契约是否在任务卡中标注为artifact?

## 事件驱动检查

- [ ] 是否定义标准事件(API_CONTRACT_READY等)?
- [ ] 是否建立事件订阅机制?
- [ ] 是否明确事件触发条件与响应动作?

## 最终验收标准

- [ ] 规划是否让0基础老板能看懂?
- [ ] 任务卡是否可直接交给AI执行?
- [ ] 依赖关系是否清晰无环?
- [ ] 时间与成本是否在预算范围内?
- [ ] 是否有明确的演示路径与验收标准?

---

严格遵守以上清单,确保规划质量!
