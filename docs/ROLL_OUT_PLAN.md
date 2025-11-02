# 可配置功能卡片系统 - 上线计划

## 概述

本文档定义可配置功能卡片系统的落地顺序和各角色交付矩阵。

**核心目标**:
- 管理员可在后台直接上新/下线AI能力,无需开发参与
- 支持多供应商冗余,主provider故障时自动降级
- 支持灰度/白名单发布控制
- 自动保存用户素材库,提高复购率

---

## 阶段1:基础设施(数据库+文档)

### 目标
搭建核心表结构和规范文档,为后续开发提供契约。

### 并行任务

#### Backend Dev
- **任务1.1**: 创建数据库迁移文件
  - feature_definitions 表
  - form_schemas 表
  - pipeline_schemas 表
  - task_steps 表
  - provider_endpoints 表
  - provider_health 表
  - assets 表
  - quota_logs 表
  - tasks 表扩展字段
- **交付物**: 8个迁移文件,可执行 `npm run migrate`
- **验收**: 所有表创建成功,外键约束正确

#### Product Planner
- **任务1.2**: 创建规范文档
  - FEATURE_DEFINITION_SPEC.md (功能定义规范)
  - FORM_SCHEMA_SPEC.md (表单Schema规范)
  - PIPELINE_SCHEMA_SPEC.md (执行Pipeline规范)
  - BILLING_AND_POLICY_SPEC.md (计费策略规范)
- **交付物**: 4个完整规范文档,每个包含至少3个示例
- **验收**: 无TODO占位符,无qa_profile_ref

- **任务1.3**: 更新各skill的FLOW.md
  - 在6个skill的FLOW.md末尾追加"依赖规范"章节
- **交付物**: 6个FLOW.md已更新
- **验收**: 所有依赖规范明确,职责边界清晰

### 验收标准
- [ ] 数据库迁移全部成功
- [ ] 所有规范文档完整
- [ ] 所有FLOW.md已更新

### 预计耗时
**2-3天**(并行执行)

---

## 阶段2:后端核心服务

### 目标
实现PipelineEngine、配额服务、Feature API。

### 顺序任务(依赖关系)

#### Backend Dev - 第1批(可并行)

**任务2.1**: Quota Service(配额服务)
- deductQuota: 预扣配额(事务+行锁)
- refundQuota: 返还配额(防重复)
- checkRateLimit: 限流检查(Redis)
- checkPlanPermission: 套餐权限验证
- addQuota: 充值配额
- **依赖**: quota_logs表已创建
- **验收**: 并发100次扣费,配额总数正确

**任务2.2**: Feature Service(功能卡片服务)
- GET /api/features: 获取可用功能列表(权限过滤)
- GET /api/features/:id/form-schema: 获取表单schema
- **依赖**: feature_definitions、form_schemas表已创建
- **验收**: 白名单功能只对指定账号可见

**任务2.3**: Provider Health Service(供应商健康检查)
- checkProviderHealth: 检查单个provider健康状态
- 定时任务: 每分钟更新provider_health
- calculateSuccessRate24h: 计算24小时成功率
- **依赖**: provider_endpoints、provider_health表已创建
- **验收**: 定时任务正常运行,provider_health实时更新

#### Billing Guard - 第1批(可并行)
**任务2.4**: 配额监控和告警
- 低配额告警(每天检查)
- 异常扣费监控(每小时检查)
- **依赖**: quota_logs表已创建
- **验收**: 告警邮件正常发送

---

#### Backend Dev - 第2批(依赖第1批)

**任务2.5**: PipelineEngine核心
- execute: 顺序执行pipeline steps
- executeSyncImageProcess: 同步图像处理
- executeRunninghubWorkflow: 异步轮询
- executeScfPostProcess: 云函数后处理
- getProviderWithHealth: 多供应商降级选择 ⚠️ **Phase 2实现**
- handleTaskFailure: 失败处理+返配额
- handleTaskSuccess: 成功处理+写素材库
- **依赖**: 任务2.1(配额服务)、任务2.3(健康检查)
- **验收**: 3种step类型都能正确执行
- **Phase 2**: 实现多供应商降级（参考 docs/多供应商降级架构设计.md）

**任务2.6**: Task Creation API
- POST /api/tasks/create: 创建任务
  - 校验权限
  - 校验限流
  - 预扣配额
  - 创建任务和task_steps
  - 触发PipelineEngine
- **依赖**: 任务2.1(配额服务)、任务2.5(PipelineEngine)
- **验收**: 配额扣减和任务创建在同一事务,限流正确拦截

**任务2.7**: SCF回调接口
- POST /api/internal/tasks/:taskId/steps/:stepIndex/callback
- 签名验证(HMAC-SHA256)
- 时间戳验证(防重放攻击)
- 更新task_steps状态
- **依赖**: 任务2.5(PipelineEngine)
- **验收**: 签名验证失败返回401,时间戳过期拒绝请求

---

#### Backend Dev - 第3批(可并行,依赖第2批)

**任务2.8**: Admin API
- GET /api/admin/features: 获取所有功能(含禁用)
- POST /api/admin/features: 创建功能卡片
- PUT /api/admin/features/:id: 更新功能卡片
- PATCH /api/admin/features/:id: 快速切换is_enabled
- DELETE /api/admin/features/:id: 软删除
- **依赖**: feature_definitions、form_schemas、pipeline_schemas表
- **验收**: 非admin访问返回403,创建时JSON结构校验

**任务2.9**: Assets API
- GET /api/assets: 获取用户素材库(分页)
- DELETE /api/assets/:id: 删除素材
- **依赖**: assets表已创建
- **验收**: 用户只能查询自己的素材

### 验收标准
- [ ] PipelineEngine能执行3种step类型
- [ ] 多供应商降级逻辑生效
- [ ] 配额预扣+失败返还正确
- [ ] SCF回调签名验证通过
- [ ] Admin API全部可用
- [ ] 素材库API全部可用

### 预计耗时
**7-10天**(分3批,第1批2天,第2批4天,第3批2天)

---

## 阶段3:云函数后处理

### 目标
实现SCF云函数,支持视频拼接、图片合成、文本处理。

### 并行任务

#### SCF Worker

**任务3.1**: 视频合成云函数
- 功能: 视频拼接+字幕叠加+Logo水印
- 输入: 视频片段URLs + 参数(logo/tagline/date)
- 输出: 最终视频URL
- 回调: POST /api/internal/.../callback
- **依赖**: 任务2.7(回调接口已实现)
- **验收**: 拼接流畅,字幕清晰,回调签名正确

**任务3.2**: 图片拼接云函数
- 功能: 九宫格/多图合成
- 输入: 图片URLs + 布局参数(3x4/2x2)
- 输出: 拼接图URL
- **依赖**: 任务2.7(回调接口已实现)
- **验收**: 布局正确,图片清晰

**任务3.3**: 文本处理云函数
- 功能: 文案模板渲染
- 输入: 模板ID + 参数(SKU名称/日期)
- 输出: 文本Bundle JSON
- **依赖**: 任务2.7(回调接口已实现)
- **验收**: 模板变量正确替换

**任务3.4**: 云函数部署
- serverless.yml配置
- 环境变量配置
- Layer配置(FFmpeg)
- deploy.sh脚本
- **依赖**: 任务3.1-3.3(云函数代码已完成)
- **验收**: 云函数能正常触发和执行

**任务3.5**: Provider Endpoints初始化
- Seed数据: 3个SCF云函数的endpoint
- credentials加密存储
- **依赖**: 任务3.4(云函数已部署,拿到URL)
- **验收**: Seed成功插入provider_endpoints表

### 验收标准
- [ ] 3个云函数部署成功
- [ ] 回调签名正确
- [ ] provider_endpoints有SCF数据
- [ ] 云函数日志不包含敏感信息

### 预计耗时
**5-7天**(可并行执行)

---

## 阶段4:前端界面

### 目标
实现工作台、动态表单、任务详情页、管理后台、素材库。

### 并行任务

#### Frontend Dev

**任务4.1**: 工作台动态卡片列表
- 调用GET /api/features
- 渲染FeatureCard组件
- 权限过滤(后端已完成,前端直接展示)
- **依赖**: 任务2.2(Feature API已实现)
- **验收**: 页面无硬编码功能,卡片按category分组

**任务4.2**: 动态表单页面
- 根据form_schema动态渲染
- 6种字段类型组件(imageUpload/enum/text/number/date)
- 客户端验证(required/validation)
- 提交时二次确认
- **依赖**: 任务2.2(Feature API已实现)
- **验收**: 同一页面可渲染任意form_schema

**任务4.3**: 任务详情页改造
- 轮询GET /api/tasks/:id
- 5种output_type展示(singleImage/multiImage/video/zip/textBundle)
- 失败状态显示"配额已自动返还"
- **依赖**: 任务2.6(Task API已实现)
- **验收**: 轮询不闪烁,5种output_type都能正确展示

**任务4.4**: 管理后台 - 功能卡片管理
- 列表页: 表格展示所有功能,is_enabled开关
- 编辑页: 3个Tab(功能定义/表单Schema/执行Pipeline)
- JSON编辑器(monaco-editor)
- 路由守卫(只允许admin访问)
- **依赖**: 任务2.8(Admin API已实现)
- **验收**: JSON编辑器有语法高亮,非admin无法访问

**任务4.5**: 素材库页面
- 列表展示用户素材(按时间倒序)
- 筛选(类型/功能/时间范围)
- 操作(下载/删除/复制URL)
- **依赖**: 任务2.9(Assets API已实现)
- **验收**: 只能查看自己的素材,删除后立即移除

**任务4.6**: 导航栏和路由
- 增加"素材库"入口
- admin角色显示"管理后台"入口
- 路由守卫
- **依赖**: 任务4.1-4.5(所有页面已完成)
- **验收**: 导航栏根据角色动态调整

### 验收标准
- [ ] 工作台动态展示功能卡片
- [ ] 动态表单正确渲染
- [ ] 任务详情页支持5种output_type
- [ ] 管理后台JSON编辑器可用
- [ ] 素材库页面可用
- [ ] 导航栏完整

### 预计耗时
**8-10天**(可并行执行)

---

## 阶段5:示例功能卡片配置

### 目标
配置3个示例功能卡片,验证整套流程。

### 顺序任务

#### Backend Dev

**任务5.1**: 配置主图清洁增强
- feature_definition (basic_clean)
- form_schema (单图上传+背景色枚举)
- pipeline_schema (单步SYNC_IMAGE_PROCESS)
- **依赖**: 管理后台已可用
- **验收**: 管理员能在后台看到并编辑

**任务5.2**: 配置AI模特12分镜
- feature_definition (model_pose12)
- form_schema (单品图+风格枚举+模特气质)
- pipeline_schema (单步RUNNINGHUB_WORKFLOW,支持provider_candidates降级)
- **依赖**: 任务5.1
- **验收**: pipeline支持多供应商降级

**任务5.3**: 配置上新合辑短片
- feature_definition (weekly_drop_trailer)
- form_schema (多SKU图+日期+口播+Logo)
- pipeline_schema (两步:RUNNINGHUB_WORKFLOW + SCF_POST_PROCESS)
- **依赖**: 任务5.2
- **验收**: pipeline正确链接两个step

#### QA Acceptance

**任务5.4**: 人工验收3个功能卡片
- 抽样测试每个功能3-5次
- 检查生成质量
- 测试失败返配额
- 测试限流拦截
- 测试权限控制
- **依赖**: 任务5.1-5.3(3个功能已配置)
- **交付**: 人工验收报告(含截图)
- **验收**: 所有功能质量达标,配额逻辑正确

**任务5.5**: 设置is_enabled=true
- 验收通过后,管理员设置is_enabled=true
- **依赖**: 任务5.4(人工验收通过)
- **验收**: 前端工作台立即显示3个功能

### 验收标准
- [ ] 3个功能卡片配置完整
- [ ] 人工验收全部通过
- [ ] is_enabled=true后前端可见

### 预计耗时
**3-4天**(包含人工验收和调整)

---

## 阶段6:测试和优化

### 目标
完成单元测试、集成测试、性能测试。

### 并行任务

#### Backend Dev
**任务6.1**: 单元测试
- quota.service测试(并发扣费/返还/限流)
- pipelineEngine测试(3种step/多供应商降级)
- **验收**: 覆盖率 > 80%

#### QA Acceptance
**任务6.2**: 集成测试
- 3个完整功能流程测试
- 失败返配额测试
- 限流测试
- 权限测试(套餐/白名单)
- **依赖**: 阶段5(示例功能已配置)
- **验收**: 所有集成测试通过

**任务6.3**: 性能测试
- 并发100个请求扣配额
- P95响应时间 < 500ms
- **验收**: 配额总数正确,响应时间达标

#### Billing Guard
**任务6.4**: 配额逻辑压测
- 并发1000次扣费
- 并发100次返还
- **验收**: 无超扣,无少扣,无重复返还

### 验收标准
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过
- [ ] 性能测试达标
- [ ] 配额逻辑压测通过

### 预计耗时
**4-5天**(可并行执行)

---

## 阶段7:代码审查和文档归档

### 目标
Reviewer审查所有代码和文档,确保符合规范。

### 顺序任务

#### Reviewer

**任务7.1**: 配额逻辑审查
- 检查deductQuota使用行锁
- 检查refundQuota防重复
- 检查不基于主观评价返配额
- **验收**: 无阻塞问题

**任务7.2**: 敏感信息审查
- 检查无密钥硬编码
- 检查无域名硬编码
- 检查credentials加密存储
- 检查前端不展示内部字段
- **验收**: 无阻塞问题

**任务7.3**: Pipeline逻辑审查
- 检查支持provider_candidates
- 检查step失败立即中断
- 检查SCF只能通过回调更新状态
- **验收**: 无阻塞问题

**任务7.4**: 前端逻辑审查
- 检查前端不本地判断权限
- 检查使用动态表单渲染
- 检查不展示内部字段
- **验收**: 无阻塞问题

**任务7.5**: 文档审查
- 检查5个规范文档完整
- 检查6个FLOW.md已更新
- 检查无TODO占位符
- 检查无qa_profile_ref
- **验收**: 文档完整

**任务7.6**: 数据库审查
- 检查8个表全部创建
- 检查关键字段存在(access_scope/provider_candidates/refunded)
- 检查外键约束
- **验收**: 数据库结构正确

**任务7.7**: 测试审查
- 检查单元测试覆盖率 > 80%
- 检查集成测试覆盖3个流程
- 检查性能测试通过
- **验收**: 测试充分

**任务7.8**: 上线前最终检查
- 勾选上线清单(40+项)
- 确认无阻塞问题
- **交付**: 审查报告+上线清单
- **验收**: 所有清单项勾选完成

### 验收标准
- [ ] 所有代码审查通过
- [ ] 所有文档审查通过
- [ ] 所有测试审查通过
- [ ] 上线清单全部勾选

### 预计耗时
**3-4天**(顺序执行,每项审查1天)

---

## 阶段8:上线部署

### 目标
部署到生产环境,开放给用户使用。

### 顺序任务

#### CodeBuddy Deploy (如有)

**任务8.1**: 数据库迁移
- 在生产环境执行数据库迁移
- 验证表结构
- **验收**: 所有表创建成功

**任务8.2**: 后端部署
- 部署后端代码到生产环境
- 配置环境变量
- 启动定时任务(provider health检查/配额监控)
- **依赖**: 任务8.1
- **验收**: 健康检查通过,API可访问

**任务8.3**: SCF部署
- 部署3个云函数到生产环境
- 配置环境变量
- 更新provider_endpoints
- **依赖**: 任务8.2
- **验收**: 云函数可正常调用

**任务8.4**: 前端部署
- 部署前端代码到生产环境
- 配置CDN
- **依赖**: 任务8.2
- **验收**: 前端页面可访问

**任务8.5**: 初始化示例功能
- 管理员登录后台
- 创建3个示例功能卡片
- 设置is_enabled=true
- **依赖**: 任务8.4
- **验收**: 前端工作台显示3个功能

**任务8.6**: 监控和告警配置
- 配置服务器监控
- 配置错误告警
- 配置配额告警
- **依赖**: 任务8.5
- **验收**: 告警正常触发

### 验收标准
- [ ] 生产环境所有服务正常运行
- [ ] 3个示例功能可用
- [ ] 监控和告警已配置

### 预计耗时
**2-3天**(顺序执行)

---

## 角色交付矩阵

### 总览表

| 阶段 | Backend Dev | Frontend Dev | SCF Worker | Billing Guard | QA Acceptance | Reviewer | Product Planner |
|------|-------------|--------------|------------|---------------|---------------|----------|-----------------|
| 阶段1 | 任务1.1 | - | - | - | - | - | 任务1.2, 1.3 |
| 阶段2 | 任务2.1-2.9 | - | - | 任务2.4 | - | - | - |
| 阶段3 | - | - | 任务3.1-3.5 | - | - | - | - |
| 阶段4 | - | 任务4.1-4.6 | - | - | - | - | - |
| 阶段5 | 任务5.1-5.3 | - | - | - | 任务5.4, 5.5 | - | - |
| 阶段6 | 任务6.1 | - | - | 任务6.4 | 任务6.2, 6.3 | - | - |
| 阶段7 | - | - | - | - | - | 任务7.1-7.8 | - |
| 阶段8 | 部署支持 | 部署支持 | 部署支持 | - | - | - | - |

### 关键路径

```
阶段1(文档+数据库) 
  → 阶段2第1批(配额/Feature/健康检查) 
    → 阶段2第2批(PipelineEngine/Task创建/SCF回调)
      → 阶段2第3批(Admin API/Assets API) 
        ↓
      阶段3(SCF云函数)    阶段4(前端界面)
        ↓                     ↓
      阶段5(示例功能配置+人工验收)
        ↓
      阶段6(测试和优化)
        ↓
      阶段7(代码审查)
        ↓
      阶段8(上线部署)
```

### 并行窗口

**最大并行度**:
- 阶段1: 2个角色并行(Backend Dev + Product Planner)
- 阶段2第1批: 2个角色并行(Backend Dev 3个任务 + Billing Guard 1个任务)
- 阶段3+阶段4: 2个角色并行(SCF Worker + Frontend Dev)
- 阶段6: 3个角色并行(Backend Dev + QA Acceptance + Billing Guard)

---

## 风险控制

### 关键风险点

**风险1: 供应商单点故障**
- **描述**: 如果主provider down,整个功能不可用
- **缓解**: 必须实现provider_candidates多供应商降级(阶段2任务2.5)
- **验收**: 主provider down时自动切换到备provider

**风险2: 配额并发超扣**
- **描述**: 高并发时配额扣减可能出错
- **缓解**: 必须使用行锁(阶段2任务2.1)
- **验收**: 并发100次扣费,配额总数正确(阶段6任务6.4)

**风险3: 管理员误操作**
- **描述**: 管理员可能设置quota_cost=0导致免费薅羊毛
- **缓解**: 管理后台增加二次确认弹窗
- **验收**: quota_cost=0时弹窗警告

**风险4: SCF回调被伪造**
- **描述**: 攻击者伪造回调修改任务状态
- **缓解**: 必须验证HMAC签名(阶段2任务2.7)
- **验收**: 签名错误返回401

**风险5: 内部字段泄露**
- **描述**: 前端展示vendorTaskId等内部信息
- **缓解**: Reviewer审查阻止(阶段7任务7.4)
- **验收**: 前端不展示内部字段

### 应急预案

**场景1: 所有provider全部down**
- **应急**: 任务创建时提示"服务暂时不可用,请稍后再试"
- **恢复**: 运维修复provider或切换新provider

**场景2: Redis故障**
- **影响**: 限流失效,可能被刷
- **应急**: 临时关闭高成本功能(设置is_enabled=false)
- **恢复**: 修复Redis后重新开启

**场景3: 配额异常扣减**
- **检测**: 配额监控告警触发(阶段2任务2.4)
- **应急**: 人工检查quota_logs,必要时手动补偿
- **修复**: 修复bug后重新上线

---

## 总体时间估算

| 阶段 | 耗时 | 可并行 |
|------|------|--------|
| 阶段1: 基础设施 | 2-3天 | 是 |
| 阶段2: 后端核心服务 | 7-10天 | 部分 |
| 阶段3: 云函数后处理 | 5-7天 | 是 |
| 阶段4: 前端界面 | 8-10天 | 是 |
| 阶段5: 示例功能配置 | 3-4天 | 否 |
| 阶段6: 测试和优化 | 4-5天 | 是 |
| 阶段7: 代码审查 | 3-4天 | 否 |
| 阶段8: 上线部署 | 2-3天 | 否 |

**最短路径**(所有可并行任务同时执行):
- 阶段1: 3天
- 阶段2: 10天(分3批)
- 阶段3+4: 10天(并行)
- 阶段5: 4天
- 阶段6: 5天(并行)
- 阶段7: 4天
- 阶段8: 3天

**总计**: 约 **39天** (约6周)

**保守估计**(考虑沟通和返工): **50天** (约7-8周)

---

## 验收门槛

### 阶段门禁(Gate)

每个阶段结束后,必须通过以下检查才能进入下一阶段:

**阶段1 → 阶段2**:
- [ ] 所有数据库迁移通过
- [ ] 5个规范文档完整
- [ ] 6个FLOW.md已更新

**阶段2 → 阶段3/4**:
- [ ] PipelineEngine能执行3种step类型
- [ ] 多供应商降级逻辑验证通过
- [ ] 配额预扣+返还正确
- [ ] Admin API可用

**阶段3/4 → 阶段5**:
- [ ] 3个云函数部署成功
- [ ] 前端所有页面可访问
- [ ] 管理后台可配置功能卡片

**阶段5 → 阶段6**:
- [ ] 3个示例功能配置完成
- [ ] 人工验收全部通过
- [ ] is_enabled=true后前端可见

**阶段6 → 阶段7**:
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过
- [ ] 性能测试达标

**阶段7 → 阶段8**:
- [ ] 所有代码审查通过
- [ ] 上线清单全部勾选
- [ ] 无阻塞问题

### 最终上线条件

- [ ] 所有阶段门禁通过
- [ ] Reviewer最终审查PASS
- [ ] 生产环境预演通过
- [ ] 回滚方案已准备

---

## Phase 2: 多供应商降级架构（后续迭代）

### 🎯 目标

实现provider健康检查和多供应商自动降级，确保系统高可用性。

### 📋 背景

**代码审查发现**（P0-3）:
- ❌ PipelineEngine只支持单一provider（硬编码provider_ref）
- ❌ 没有provider健康检查机制
- ❌ 主provider故障时无法自动切换

**详细设计文档**: [docs/多供应商降级架构设计.md](./多供应商降级架构设计.md)

---

### 📅 实施计划

#### Phase 2.1: 数据库和基础服务（1-2天）

**Backend Dev任务**:
- [ ] 完善 provider_health 表迁移文件
- [ ] 创建 ProviderHealthService（健康检查服务）
- [ ] 编写单元测试（success/failure记录、健康查询）
- [ ] 初始化所有provider的健康记录

**交付物**:
- `backend/src/services/providerHealth.service.js`
- `backend/tests/providerHealth.service.test.js`

---

#### Phase 2.2: PipelineEngine改造（1-2天）

**Backend Dev任务**:
- [ ] 修改 executePipeline 方法支持 provider_candidates
- [ ] 修改 executeStep 方法集成健康检查
- [ ] 添加成功/失败健康状态记录
- [ ] 编写集成测试（多provider降级场景）

**交付物**:
- 改造后的 `backend/src/services/pipelineEngine.service.js`
- `backend/tests/pipelineEngine.multi-provider.test.js`

---

#### Phase 2.3: 定时任务和监控（1天）

**Backend Dev任务**:
- [ ] 添加健康检查定时任务（每30秒）
- [ ] 集成告警逻辑
- [ ] 创建监控仪表盘（可选）
- [ ] 编写运维文档

**交付物**:
- 改造后的 `backend/src/services/cronJobs.service.js`
- `docs/Provider健康监控运维手册.md`

---

#### Phase 2.4: Pipeline Schema升级（0.5天）

**Backend Dev任务**:
- [ ] 更新现有 pipeline_schemas 添加 provider_candidates
- [ ] 创建示例配置文档

**示例配置**:
```json
{
  "steps": [{
    "type": "image_enhance",
    "provider_ref": "runninghub_image",
    "provider_candidates": [
      "runninghub_image",
      "alicloud_image"
    ]
  }]
}
```

---

#### Phase 2.5: 测试和上线（0.5天）

**QA Acceptance任务**:
- [ ] 端到端测试（主provider故障场景）
- [ ] 压力测试（100并发 + provider故障）
- [ ] 灰度发布（20%流量）
- [ ] 全量发布

---

### ✅ 验收标准

- [ ] ProviderHealthService正常运行
- [ ] 主provider down时自动切换到备provider
- [ ] 所有provider都down时任务失败并返还配额
- [ ] 健康检查定时任务正常运行
- [ ] 降级统计日志完整
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过

---

### 📊 预期效果

| 指标 | 改造前 | 改造后 | 提升 |
|------|--------|--------|------|
| **单点故障风险** | 100% | 0% | ✅ 消除 |
| **自动降级响应** | 无 | <100ms | ✅ 新增 |
| **故障恢复时间** | 人工干预（数小时） | <1分钟 | 🔥 提升99% |
| **用户体验** | 主provider故障→全部失败 | 自动切换→无感知 | ✅ 显著提升 |

---

### ⏱️ 预计工作量

**总计**: 3.5-5.5天

**建议**: Phase 1上线后立即启动Phase 2，确保高可用 ⚠️

---

## 附录:关键决策点

### 为什么先做后端再做前端?

因为前端动态表单依赖后端API(GET /api/features/:id/form-schema),必须先有API才能开发前端。

### 为什么SCF和前端可以并行?

SCF只负责后处理,前端可以先mock SCF输出,两者独立开发,最后集成。

### 为什么人工验收不能跳过?

因为我们不做运行时自动质检,质量闸门在is_enabled=true之前,必须人工确认生成质量达标。

### 为什么代码审查必须顺序执行?

因为Reviewer需要全局视角审查所有代码,确保各模块协同正确,不能分散审查。

---

**本文档为最终版本,所有角色必须严格按照此计划执行。任何偏离计划的行为必须由Product Planner批准。**
