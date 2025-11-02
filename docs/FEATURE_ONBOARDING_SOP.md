# 功能上新 SOP(标准操作流程)

## 适用对象
- 运营人员(需 Admin 权限)
- 产品经理
- 技术支持人员

## 前置条件
- 已获得 Admin 后台访问权限
- 已准备好功能的表单Schema和Pipeline Schema
- 已完成人工验收(QA确认功能可用)

---

## 第1步:准备 Schema 模板

### 1.1 选择基础模板
登录 Admin 后台 → 功能管理 → 新增功能卡片,根据功能类型选择模板:

| 功能类型 | 推荐模板 | 说明 |
|---------|---------|------|
| 单图处理 | 主图清洁增强 | 输入1张图,输出1张图 |
| 多图生成 | AI模特12分镜 | 输入参数,输出12张图 |
| 视频合成 | 上新合辑短片 | 输入多个素材,输出1个视频 |

### 1.2 修改 Form Schema
点击"Tab2 表单Schema",修改字段:
- `fieldKey`: 字段唯一标识(英文,无空格)
- `label`: 显示给用户的标签
- `type`: 字段类型(imageUpload/multiImageUpload/enum/text/number/date)
- `required`: 是否必填
- `validation`: 校验规则(文件大小、类型、数值范围等)
- `map_to_pipeline`: 映射到 Pipeline 哪个步骤的哪个参数

**示例**(新增"商品背景色"字段):
```json
{
  "fieldKey": "backgroundColor",
  "label": "背景色",
  "type": "enum",
  "required": true,
  "options": [
    { "value": "white", "label": "纯白" },
    { "value": "gradient", "label": "渐变" }
  ],
  "defaultValue": "white",
  "map_to_pipeline": [
    { "step_index": 0, "param_key": "bg_color" }
  ]
}
```

### 1.3 修改 Pipeline Schema
点击"Tab3 执行Pipeline",修改步骤:

**关键字段说明**:
- `type`: 步骤类型(SYNC_IMAGE_PROCESS/RUNNINGHUB_WORKFLOW/SCF_POST_PROCESS)
- `provider_ref`: 主供应商ID
- `provider_candidates`: 降级供应商列表(按优先级排序)
- `input_mapping`: 输入参数映射
- `expected_output`: 期望输出类型
- `timeout_seconds`: 超时时间(可选,默认300秒)
- `retry_limit`: 重试次数(可选,默认0)

**多供应商降级示例**:
```json
{
  "type": "RUNNINGHUB_WORKFLOW",
  "provider_ref": "runninghub_primary",
  "provider_candidates": [
    "runninghub_primary",
    "runninghub_backup",
    "internal_fallback"
  ],
  "timeout_seconds": 300,
  "retry_limit": 1
}
```

---

## 第2步:配置功能定义

### 2.1 填写基本信息(Tab1)
- **feature_id**: 功能唯一ID(英文+下划线,例如 `product_bg_remove`)
- **display_name**: 显示名称(中文,用户看到的)
- **category**: 分类(视觉图像/视频创作/文案生成/其他)
- **description**: 功能描述(1-2句话说明用途)

### 2.2 配置权限策略
**套餐权限模式**(plan):
- **access_scope**: 选择 `plan`
- **plan_required**: 选择最低套餐(基础/PRO/企业)
- **allowed_accounts**: 留空

**白名单模式**(内测/灰度):
- **access_scope**: 选择 `whitelist`
- **allowed_accounts**: 每行一个账号ID,例如:
  ```
  123
  456
  789
  ```
- **plan_required**: 选择"基础"(白名单不检查套餐)

### 2.3 配置计费策略
- **quota_cost**: 单次消耗配额数(整数,最小1)
  - ⚠️ **警告**: 设为0将导致免费使用,可能造成成本失控
- **rate_limit_policy**: 限流策略,格式 `时间窗口:次数`
  - 示例: `hourly:10` (每小时最多10次)
  - 示例: `daily:100` (每天最多100次)

### 2.4 配置输出类型
- **output_type**: 
  - `singleImage`: 单张图片
  - `multiImage`: 多张图片
  - `video`: 视频
  - `zip`: 压缩包
  - `textBundle`: 文本内容
- **save_to_asset_library**: 是否自动保存到素材库(推荐开启)

### 2.5 初始状态
- **is_enabled**: ⚠️ 先设为 `false`(保存后再开启)

---

## 第3步:保存并校验

### 3.1 点击"预览"
- 检查动态表单渲染是否正确
- 检查所有必填字段是否显示红色星号
- 检查字段顺序和提示文案

### 3.2 点击"保存"
- 如果返回 400 错误,检查 JSON Schema 语法错误(红色高亮位置)
- 常见错误:
  - map_to_pipeline 中的 step_index 超出范围
  - provider_ref 不存在
  - fieldKey 重复

### 3.3 校验成功
- 返回功能列表页,确认新功能已创建
- 此时 is_enabled=false,前台不可见

---

## 第4步:小流量灰度测试

### 4.1 设置白名单
- 编辑功能 → Tab1 → access_scope 改为 `whitelist`
- allowed_accounts 填入测试账号ID(建议3-5个)
- 保存

### 4.2 开启功能
- 列表页点击 is_enabled 开关
- ⚠️ 如果 quota_cost=0,会弹出红色警告,需二次确认

### 4.3 白名单测试
- 使用测试账号登录前台
- 检查工作台是否显示新功能卡片
- 提交任务,检查:
  - 表单验证是否生效
  - 配额是否正确扣除
  - 任务是否正常执行
  - 失败时配额是否返还
  - 结果是否保存到素材库

### 4.4 记录测试结果
| 测试项 | 期望结果 | 实际结果 | 是否通过 |
|--------|---------|---------|---------|
| 表单渲染 | 所有字段正确显示 | ✅ | 通过 |
| 配额扣除 | 扣除X配额 | ✅ | 通过 |
| 任务执行 | 状态变为success | ✅ | 通过 |
| 失败返还 | 配额自动返还 | ✅ | 通过 |
| 素材库保存 | 自动写入 | ✅ | 通过 |

---

## 第5步:全量上线

### 5.1 切换为套餐模式
- 编辑功能 → Tab1 → access_scope 改为 `plan`
- plan_required 设为目标套餐(基础/PRO/企业)
- allowed_accounts 清空
- 保存

### 5.2 确认上线
- 刷新前台,不同套餐用户检查卡片可见性
- 基础会员不应看到PRO功能(卡片不展示,不是禁用态)

---

## 第6步:监控和回滚

### 6.1 监控指标
- 调用量: 每小时/每天调用次数
- 成功率: 成功任务数 / 总任务数
- 配额消耗: 总配额消耗量
- 错误率: 失败任务占比

### 6.2 异常情况处理

**情况1: 调用量暴增**
- 检查是否有恶意刷量
- 调整 rate_limit_policy(降低频次)
- 临时关闭 is_enabled

**情况2: 成功率低**
- 检查 provider_health 表,确认供应商状态
- 检查错误日志,定位问题步骤
- 临时关闭 is_enabled,等待修复

**情况3: 配额消耗异常**
- 检查 quota_cost 是否设为0
- 检查返还逻辑是否失效

### 6.3 紧急回滚
如需紧急下线功能:
1. 列表页点击 is_enabled 开关(立即关闭)
2. 或删除功能(软删除,数据保留)

---

## 第7步:日常维护

### 7.1 定期检查
- 每周检查功能调用量和成功率
- 每月检查供应商健康状态
- 每季度检查素材库存储占用

### 7.2 更新 Schema
如需修改表单或Pipeline:
1. 编辑功能 → 修改 Schema
2. 保存前点击"预览"确认渲染正确
3. 保存后刷新前台测试

### 7.3 调整计费策略
如需调整配额消耗:
1. 编辑功能 → Tab1 → quota_cost 改为新值
2. 保存后立即生效(新任务按新价格扣费)

---

## 常见问题 FAQ

### Q1: 白名单账号看不到功能?
**A**: 检查以下几点:
- GET /api/features 是否按 user_id 过滤
- allowed_accounts 字段是否包含该账号ID
- is_enabled 是否为 true
- 前端是否清除缓存

### Q2: 任务失败但配额没返还?
**A**: 检查:
- tasks.eligible_for_refund 是否为 true
- tasks.refunded 是否为 false
- handleTaskFailure 是否正确执行

### Q3: 供应商降级不生效?
**A**: 检查:
- provider_candidates 是否配置
- provider_health 表是否有数据
- 定时任务是否正常运行

### Q4: JSON Schema 保存失败?
**A**: 常见错误:
- map_to_pipeline 的 step_index 超出 pipeline.steps 数组长度
- provider_ref 在 provider_endpoints 表中不存在
- JSON 语法错误(缺少逗号、括号等)

### Q5: 前端表单字段顺序错乱?
**A**: form_schema.fields 是数组,顺序即为展示顺序,检查 JSON 中的顺序

---

## 附录: Schema 快速参考

### Form Schema 字段类型
| type | 说明 | validation 支持 |
|------|------|-----------------|
| imageUpload | 单图上传 | maxSize, allowedTypes |
| multiImageUpload | 多图上传 | maxCount, maxSize, allowedTypes |
| enum | 枚举选择 | options(数组) |
| text | 文本输入 | maxLength, pattern |
| number | 数值输入 | min, max |
| date | 日期选择 | minDate, maxDate |

### Pipeline Schema step 类型
| type | 说明 | 是否异步 | 回调方式 |
|------|------|---------|---------|
| SYNC_IMAGE_PROCESS | 同步图像处理 | 否 | 直接返回结果 |
| RUNNINGHUB_WORKFLOW | 外部异步生成 | 是 | 轮询 |
| SCF_POST_PROCESS | 云函数后处理 | 是 | 回调 |

### Rate Limit 时间窗口
| 格式 | 说明 |
|------|------|
| hourly:X | 每小时最多X次 |
| daily:X | 每天最多X次 |
| weekly:X | 每周最多X次 |
| monthly:X | 每月最多X次 |

---

**文档版本**: v1.0  
**最后更新**: 2025-10-29  
**维护人**: Product Planner Team
