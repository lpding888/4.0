# Product Planner Skill - 完整示例(EXAMPLES)

本文件提供真实可用的标准输出示例,便于复制落地。

## 示例1:三阶段需求澄清对话

老板说:"我要一个 CMS 配置系统,4 周可演示。"

阶段A:商业目标(3-5问)
1. 目标 KPI 是什么?例如上线时间、预计内容类型数量、管理员人数、每日内容项 CRUD 量级?
2. 预算上限是多少?是否希望成本最小化优先?
3. 用户是谁?是内部运营还是外部商家?是否存在合规要求(数据驻留/审计)?

阶段B:技术边界(2-3问)
4. 技术偏好:自研为主还是第三方/混合?是否允许使用 COS、SCF、Redis?
5. 是否已有域名、服务器资源(4核4G + PM2 + 宝塔面板)可复用?
6. 是否要求前后端分离,以及是否约定 Next.js 14 / Express + Knex + MySQL 8 标配?

阶段C:验收标准(2-3问)
7. MVP 演示路径是什么?(例如:建一个"文章"类型 → 新建文章 → 审核发布 → 前台 API 可读取)
8. 验收以可演示路径跑通为准,还是需要UT≥80%/E2E也达标?
9. 是否需要审计日志与RBAC在 MVP 一并上线?

若老板未答复(默认假设示例):
- A-001:管理员≤5,内容类型≤20,日 CRUD ≤ 2000
- A-002:允许使用 COS 存储、多区域无强制要求、国内单区即 MVP
- A-003:MVP 只要求演示路径与核心 UT ≥ 70%,E2E 在 Beta 完成

## 示例2:完整产品规划输出(10部分)

项目:CMS;目标:4 周可演示;预算:1500 美金(软上限)

1. 背景与目标
- 帮助运营在 4 周内上线可演示 CMS:建模→内容→审核发布→前台读取
- KPI:MVP 演示路径可跑通;管理员≤5;内容类型≤20;平均响应 P95 ≤ 200ms

2. 用户画像与关键场景
- 运营创建内容类型(文章/作品/页面),编辑内容,审核发布,查看历史版本与回滚
- 小商家配置营销页;摄影工作室批量管理作品与媒资

3. 范围与优先级
- P0:内容类型建模、内容项 CRUD、RBAC(3 角色)、发布状态机、媒体直传签名、审计日志(简版)、健康检查、错误统一
- P1:媒体元数据、发布 Webhook、列表高级筛选、E2E 测试集
- P2:搜索 DSL、国际化、导入导出

4. 技术选型(混合)
- 自研:核心建模/内容/权限/发布
- 第三方:COS(存储)、SCF(转码/回调)、Redis(缓存)
- 栈:Next.js 14 + AntD + Zustand;Express + Knex + MySQL 8 + Redis;PM2 三进程

5. 架构与契约
- API:REST + OpenAPI(契约先行)
- 前端:基于 AntD 的建模 UI 与内容管理台
- 事件:API_CONTRACT_READY/ACK、SCF_JOB_*、REVIEW_*、QA_*
- 鉴权:JWT + RBAC(Admin/Editor/Viewer)

6. 数据与权限
- 表:content_types、content_fields、content_items、audit_logs、users、roles、role_bindings
- 索引:content_types.slug 唯一;content_items(type_id,status) 复合索引
- 权限:Admin(全权)、Editor(编辑与提交审核)、Viewer(只读)

7. 风险与应对(含默认假设)
- 需求膨胀 → 严格执行 P0 清单
- 媒体处理耗时 → 下放 SCF 异步 + 回调
- 性能瓶颈 → Redis 缓存 + 必要索引
- A-001/A-002/A-003 默认假设在 Week2 里程碑前复核

8. 任务卡清单(按部门) - 节选,详见示例3

9. 周计划
- Week1:B-001/002/012/015、F-001/008、规划落库
- Week2:B-003、F-002/003、S-001/002
- Week3:B-004/005、F-005/006、S-003、QA-Q-001
- Week4:QA-Q-002/003、优化与部署、演示脚本

10. 验收与交付
- 演示脚本:创建"文章"类型 → 新建文章 → 审核发布 → 前台查询
- 文档:OpenAPI、UI 原型、事件契约、测试报告、上线单
- 门禁:Reviewer 通过、QA 冒烟/必要回归通过、Billing Guard 预算未超

## 示例3:任务卡清单(真实可用,完整18字段)

参考Q13回答中的8个完整任务卡示例(CMS-B-001、CMS-B-002、CMS-F-001、CMS-F-002、CMS-S-001、CMS-Q-001、CMS-R-001、CMS-D-001)

每个任务卡包含:
- taskId, projectId, module, title, department, phase, priority, estimatedHours
- dependencies, description, technicalRequirements, acceptanceCriteria
- deliverables, needsCoordination, aiPromptSuggestion
- reviewPolicy, qaPolicy, status

## 示例4:错误示例(不合格输出对照)

❌ 缺少验收标准:无acceptanceCriteria、无estimatedHours、无aiPromptSuggestion、无dependencies
❌ 跨部门混合卡:混合部门;无法分配与并行;缺失契约
❌ 工作量失控:>12h 未拆分;属于多个模块;不可执行

以上示例可直接用于生产环境,确保规划质量!
