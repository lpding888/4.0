# 📋 服装视频生成功能（Video Generate）- 完整迷你PRD

## 【功能名称】
服装视频生成（Fashion Video Generation）

---

## 【业务价值】
商家上传一张服装图，系统自动生成一段8秒的专业展示视频（含自动配套音频），并通过COS工作流自动生成多清晰度版本、智能封面、GIF预览，支持自适应码流播放。相比静态图片，能显著提升用户转化率和品牌展示效果。

---

## 【目标用户】
- 已付费会员（有配额的商家运营）
- 使用场景：电商商品展示、社交媒体内容制作、品牌宣传

---

## 【前端入口】

### 1. 工作台新增功能卡
- **位置**：在"基础修图"和"AI模特12分镜"旁边新增第4个卡片
- **卡片名称**："服装视频生成"
- **卡片样式**：玻璃卡+霓虹高光按钮（符合高奢系UI）
- **点击进入**：`/task/video`

### 2. 表单页面 `/task/video`
- 上传服装图（COS直传）
- 显示处理进度
- 提交按钮消耗5次配额

### 3. 任务详情页 `/task/[taskId]`
- 支持多清晰度视频播放（自动选择）
- 智能封面展示
- 支持下载视频（720p/480p/HLS）
- 显示生成进度（processing/success/failed）

---

## 【处理流程 - 异步任务】

### 完整流程图

```
[用户上传服装图到COS]
         ↓
[后端 POST /task/create]
   ├─ 校验会员+配额
   ├─ 预扣5次配额（行锁原子性）
   ├─ 创建任务记录(status=processing)
   ├─ 同步调用混元生成拍摄脚本（<5秒）
   ├─ 同步调用KUAI创建视频（<2秒）
   ├─ 获得vendor_task_id并保存
   └─ 返回 taskId (整个过程<30秒)
         ↓
[后端定时轮询任务 - Node.js定时任务]
   ├─ 每5分钟检查一次processing任务
   ├─ 调用 KUAI /v1/video/query 查询
   │
   ├─ 如果status=success:
   │  ├─ 下载video_url到 COS input/{userId}/{taskId}/original.mp4
   │  ├─ 【自动触发COS工作流】
   │  │  ├─ 转码为720p → output/{userId}/{taskId}/720p.mp4
   │  │  ├─ 转码为480p → output/{userId}/{taskId}/480p.mp4
   │  │  ├─ 转码为HLS-ABR → output/{userId}/{taskId}/playlist.m3u8
   │  │  ├─ 智能截帧生成封面 → output/{userId}/{taskId}/cover.jpg
   │  │  └─ 转为GIF预览 → output/{userId}/{taskId}/preview.gif
   │  │
   │  ├─ 工作流完成后更新数据库：
   │  │  ├─ status=success
   │  │  ├─ resultUrls=[720p_url, 480p_url, hls_url]
   │  │  ├─ coverUrl
   │  │  └─ thumbnailUrl
   │  └─ 配额不返还 ✓
   │
   ├─ 如果status=failed:
   │  ├─ 更新任务status=failed
   │  ├─ 返还5次配额
   │  └─ 任务完成 ✓
   │
   ├─ 如果超过2小时仍未完成:
   │  ├─ 强制标记为failed（超时）
   │  ├─ 返还5次配额
   │  └─ 停止轮询 ✓
   │
   └─ 否则继续轮询
         ↓
[前端轮询任务详情页 - 3秒一次]
   ├─ GET /task/:taskId
   ├─ status=processing时: "视频生成中..."
   ├─ status=success时: 显示视频+智能封面
   └─ status=failed时: 显示错误信息
```

---

## 【后端接口需求】

### 1. POST /task/create（支持新type）
```json
请求体：
{
  "type": "video_generate",
  "inputImageUrl": "cos://input/user123/task456/original.jpg",
  "params": {
    "model": "veo3-fast"
  }
}

响应（成功）：
{
  "taskId": "task789",
  "status": "processing"
}

响应（失败）：
{
  "success": false,
  "error": {
    "code": "QUOTA_INSUFFICIENT",
    "message": "配额不足，需要5次，当前剩余3次"
  }
}
```

### 2. GET /task/:taskId（查询任务详情）
```json
响应（processing）：
{
  "taskId": "task789",
  "type": "video_generate",
  "status": "processing",
  "createdAt": "2025-04-05T10:00:00Z"
}

响应（success）：
{
  "taskId": "task789",
  "type": "video_generate",
  "status": "success",
  "resultUrls": [
    "https://cdn.aizhao.icu/output/720p.mp4",
    "https://cdn.aizhao.icu/output/480p.mp4",
    "https://cdn.aizhao.icu/output/playlist.m3u8"
  ],
  "coverUrl": "https://cdn.aizhao.icu/output/cover.jpg",
  "thumbnailUrl": "https://cdn.aizhao.icu/output/preview.gif",
  "createdAt": "2025-04-05T10:00:00Z",
  "completedAt": "2025-04-05T10:15:00Z"
}

响应（failed）：
{
  "taskId": "task789",
  "type": "video_generate",
  "status": "failed",
  "errorReason": "KUAI_GENERATION_FAILED",
  "createdAt": "2025-04-05T10:00:00Z"
}
```

---

## 【后端混元脚本生成需求】

### 调用时机
在 POST /task/create 中同步调用（不需要SCF，后端直接处理）

### 提示词模板（存储在config文件）
```
你是一个专业的视频编导。根据这张服装图片，为一个8秒的短视频编写详细拍摄脚本。

脚本应包括以下4个镜头：
[镜头1] 开场镜头：简洁介绍服装和品牌风格
[镜头2] 主体展示：模特穿着该服装走动、转身、展示
[镜头3] 细节特写：服装细节、面料、工艺等的特写
[镜头4] 结束镜头：最终效果展示和品牌形象传达

内容要素要求：
- 服装类型识别：根据图片识别是上衣/裙子/裤子等
- 动作设计：符合服装特点和风格的自然动作
- 运镜方式：专业的摄影机运动（推拉摇移跟升降）
- 灯光设置：与服装风格相匹配的灯光搭配
- 背景氛围：专业级别的商业展示背景
- 音乐建议：适合的背景音乐类型和节奏

脚本要求：
- 总长度：200-300字
- 语言：中文描述
- 风格：专业、具体、可执行
- 格式：按镜头分段描述
```

---

## 【KUAI API调用配置】

### 1. 创建视频请求
```
Endpoint: https://apis.kuai.host/v1/video/create
Method: POST
Headers:
  - Authorization: Bearer YOUR_KUAI_API_KEY
  - Content-Type: application/json
  - Accept: application/json

请求体：
{
  "model": "veo3-fast",
  "prompt": "拍摄脚本内容（中文，混元生成）",
  "images": ["cos://input/user123/task456/original.jpg"],
  "aspect_ratio": "16:9",
  "enhance_prompt": true,     // 自动中文转英文
  "enable_upsample": false    // 保持720p
}

响应：
{
  "id": "veo3-fast:1757555257-PORrVn9sa9",
  "status": "pending",
  "status_update_time": 1757555257582,
  "enhanced_prompt": "..."
}
```

### 2. 查询视频状态
```
Endpoint: https://apis.kuai.host/v1/video/query?id={vendor_task_id}
Method: GET
Headers: 同上

响应（处理中）：
{
  "id": "veo3-fast:1757555257-PORrVn9sa9",
  "status": "pending/processing",
  "status_update_time": 1757555257582
}

响应（完成）：
{
  "id": "veo3-fast:1757555257-PORrVn9sa9",
  "status": "success",
  "video_url": "https://kuai-cdn.xxx/result.mp4",
  "status_update_time": 1757555257582
}

响应（失败）：
{
  "id": "veo3-fast:1757555257-PORrVn9sa9",
  "status": "failed",
  "error_message": "...",
  "status_update_time": 1757555257582
}
```

---

## 【COS工作流配置】

### 工作流触发条件
当文件上传到 input/{userId}/{taskId}/original.mp4 时自动触发

### 工作流处理步骤

#### Step 1: 视频转码（720p）
```
输入：input/{userId}/{taskId}/original.mp4
输出：output/{userId}/{taskId}/720p.mp4
参数：分辨率1280x720, 码率2000kbps, H.264 MP4
```

#### Step 2: 视频转码（480p）
```
输入：input/{userId}/{taskId}/original.mp4
输出：output/{userId}/{taskId}/480p.mp4
参数：分辨率854x480, 码率800kbps, H.264 MP4
```

#### Step 3: 转码为HLS-ABR
```
输入：output/{userId}/{taskId}/720p.mp4 + 480p.mp4
输出：output/{userId}/{taskId}/playlist.m3u8 + 分片文件
参数：片段时长6秒, 自动切换清晰度
```

#### Step 4: 智能截帧生成封面
```
输入：input/{userId}/{taskId}/original.mp4
输出：output/{userId}/{taskId}/cover.jpg
参数：使用AI选择最优帧, 分辨率1280x720, 质量90
```

#### Step 5: 生成GIF预览
```
输入：input/{userId}/{taskId}/original.mp4
输出：output/{userId}/{taskId}/preview.gif
参数：时间范围0-3秒, 分辨率640x360, 帧率10fps
```

---

## 【后端定时轮询策略】

### 实现方式
使用Node.js的node-cron库，配置：每5分钟执行一次（'*/5 * * * *'）

### 轮询逻辑
```
每5分钟运行一次：

1. 查询所有 status='processing' 且 type='video_generate' 的任务
2. 对每个任务调用 KUAI /v1/video/query?id={vendorTaskId}

if status='success':
  ├─ 下载 video_url 到 COS: input/{userId}/{taskId}/original.mp4
  ├─ COS工作流自动触发处理
  ├─ 等待工作流完成
  ├─ 更新数据库：status=success, resultUrls, coverUrl, thumbnailUrl
  └─ 配额不返还

else if status='failed':
  ├─ 更新 status=failed
  ├─ 返还5次配额
  └─ completedAt=now

else if (now - createdAt) > 2 hours:
  ├─ 更新 status=failed
  ├─ errorReason=TIMEOUT
  ├─ 返还5次配额
  └─ 停止轮询

else:
  └─ 继续轮询
```

---

## 【数据库表结构】

```sql
tasks表（扩展字段）：
├─ taskId (PK)
├─ userId (FK)
├─ type = 'video_generate'
├─ status = 'processing' / 'success' / 'failed'
├─ inputImageUrl (用户上传的原始图片)
├─ vendorTaskId (KUAI返回的task_id)
├─ resultUrls (JSON数组：[720p_url, 480p_url, hls_url])
├─ coverUrl (智能封面URL)
├─ thumbnailUrl (GIF预览URL)
├─ errorReason (失败原因)
├─ quotaUsed = 5
├─ createdAt
├─ completedAt
└─ updatedAt
```

---

## 【配额与计费策略】

| 场景 | 消耗 | 返还 | 备注 |
|------|------|------|------|
| 创建任务时 | 5次 | 不返 | 会员+配额≥5 |
| 混元脚本生成失败 | 5次 | 返5 | 后端捕获异常 |
| KUAI生成失败 | 5次 | 返5 | status=failed |
| 2小时超时 | 5次 | 返5 | 保护用户 |
| 生成成功 | 5次 | 不返 | 用户获得视频 |

### 前置条件检查
```
用户点击功能卡时：
├─ isMember == true
├─ quota_remaining >= 5
├─ quotaExpireAt > now
└─ 否则：弹出升级/续费对话框
```

---

## 【前端播放器集成】

### 推荐方案
使用腾讯云 TCPlayer（支持HLS-ABR自适应码流）

### 播放逻辑
```
当 status='success' 时：
├─ 显示智能封面（coverUrl）
├─ 初始化TCPlayer
├─ 优先使用HLS-ABR（自适应）
├─ 如果浏览器不支持HLS，降级到720p MP4
├─ 支持清晰度菜单切换
└─ 支持下载按钮（720p/480p/HLS）
```

---

## 【验收标准】

上线前必须满足：

1. ✅ **会员可见**：会员工作台看到卡片
2. ✅ **表单功能**：能上传图片
3. ✅ **配额扣减**：点击生成时立即扣5次
4. ✅ **视频生成**：能看到8秒有声视频
5. ✅ **多清晰度**：支持720p/480p切换
6. ✅ **HLS播放**：支持自适应码流播放
7. ✅ **智能封面**：封面质量优良
8. ✅ **GIF预览**：预览正常加载
9. ✅ **下载功能**：能下载视频
10. ✅ **失败返还**：失败时配额返还
11. ✅ **超时处理**：>2小时自动失败并返还
12. ✅ **非会员限制**：无法使用

---

## 【技术参数总结】

✅ 视频时长：8秒  
✅ 原始分辨率：720p  
✅ 转码分辨率：720p + 480p  
✅ HLS-ABR：支持  
✅ 帧率：24fps  
✅ 音频：自动生成  
✅ 智能封面：支持  
✅ GIF预览：支持  
✅ 配额消耗：5次  
✅ 失败返还：全部返还  
✅ 轮询频率：5分钟  
✅ 超时时间：2小时  
✅ CDN加速：开启  

---

# 【任务分派与并行执行计划】

## 📌 可以并行执行的任务（不存在依赖关系）

### **第一阶段（并行执行）**

#### **任务1️⃣：Backend Dev Skill - 后端核心接口与轮询逻辑**
**优先级**: P0  
**工期估计**: 3-4天  
**责任范围**:
- 实现 POST /task/create 支持 type='video_generate'
- 实现 GET /task/:taskId 返回视频相关字段
- 实现配额预扣5次的原子性操作
- 实现混元大模型同步调用
- 实现KUAI API同步调用
- 实现定时轮询任务（node-cron 5分钟一次）
- 实现COS文件下载逻辑
- 实现配额返还逻辑（失败和超时场景）
- 数据库迁移：tasks表扩展字段

**验收标准**:
- [ ] POST /task/create 能扣5次配额
- [ ] GET /task/:taskId 能返回正确状态
- [ ] 后端轮询能正确查询KUAI API
- [ ] 失败时配额能正确返还
- [ ] 超时2小时能自动失败并返还

---

#### **任务2️⃣：Frontend Dev Skill - 前端页面与播放器**
**优先级**: P0  
**工期估计**: 2-3天  
**责任范围**:
- 工作台新增"服装视频生成"功能卡片
- 实现 /task/video 表单页面
- 集成COS直传上传功能
- 扩展 /task/[taskId] 支持视频播放
- 集成TCPlayer支持HLS-ABR自适应码流
- 实现多清晰度切换UI
- 实现下载按钮
- 显示智能封面
- 实现3秒轮询状态更新

**验收标准**:
- [ ] 工作台能看到功能卡片
- [ ] /task/video 表单能上传图片
- [ ] TCPlayer能播放HLS和MP4
- [ ] 能切换720p/480p清晰度
- [ ] 能下载视频
- [ ] 状态实时更新

---

#### **任务3️⃣：Database Migration - 数据库迁移脚本**
**优先级**: P0  
**工期估计**: 1天  
**责任范围**:
- 创建 tasks 表扩展字段的迁移脚本
- 新增字段：vendorTaskId, resultUrls, coverUrl, thumbnailUrl, errorReason
- 修改 type 字段支持 'video_generate'

**验收标准**:
- [ ] 迁移脚本能执行
- [ ] 新字段在tasks表中存在

---

#### **任务4️⃣：COS Workflow Config - COS工作流配置**
**优先级**: P0  
**工期估计**: 1天  
**责任范围**:
- 在腾讯云COS控制台配置工作流
- 配置转码（720p/480p）
- 配置HLS-ABR生成
- 配置智能截帧生成封面
- 配置GIF生成
- 配置CDN加速

**验收标准**:
- [ ] 工作流能自动触发
- [ ] 输出文件路径正确
- [ ] 转码质量符合要求

---

## 📍 第二阶段（测试与集成）

#### **任务5️⃣：Integration Testing - 端到端集成测试**
**优先级**: P0  
**工期估计**: 2天  
**依赖**: 任务1、2、3、4完成  
**责任范围**:
- 测试完整流程：上传→生成脚本→创建视频→轮询→下载→播放
- 测试配额扣减和返还
- 测试失败和超时场景
- 性能测试（并发用户）
- 安全性测试（权限控制）

---

#### **任务6️⃣：Billing Guard Skill - 计费审查**
**优先级**: P1  
**工期估计**: 1天  
**依赖**: 任务1完成  
**责任范围**:
- 审查5次配额消耗的合理性
- 审查失败返还逻辑的完整性
- 审查超时返还的保护机制
- 审查配额原子性和行锁实现

---

#### **任务7️⃣：Reviewer Skill - 最终审查**
**优先级**: P1  
**工期估计**: 1天  
**依赖**: 任务1、2、5、6完成  
**责任范围**:
- 审查接口合同（请求/响应格式）
- 审查安全边界（权限、XSS、注入）
- 审查性能指标
- 审查用户体验
- 生成上线清单

---

## 🎯 执行时间线

```
Week 1:
├─ Day 1-2: 任务1、2、3、4 并行执行
├─ Day 3-4: 继续任务1、2
└─ Day 5: 任务5（集成测试）开始

Week 2:
├─ Day 1-2: 任务5 继续 + 任务6（计费审查）
├─ Day 3: 任务6、7 并行审查
└─ Day 4-5: 问题修复 + 上线准备

预计上线：周末前
```

---

## ✅ 分派总结

| 技能 | 任务 | 优先级 | 工期 | 并行 |
|------|------|--------|------|------|
| Backend Dev | 任务1 | P0 | 3-4天 | ✅ 可并行 |
| Frontend Dev | 任务2 | P0 | 2-3天 | ✅ 可并行 |
| Database | 任务3 | P0 | 1天 | ✅ 可并行 |
| COS Admin | 任务4 | P0 | 1天 | ✅ 可并行 |
| Test Dev | 任务5 | P0 | 2天 | ⏳ 依赖1-4 |
| Billing Guard | 任务6 | P1 | 1天 | ⏳ 依赖1 |
| Reviewer | 任务7 | P1 | 1天 | ⏳ 依赖1、2、5、6 |

---

**🚀 建议立即启动任务1-4，它们完全独立可以并行执行！**
