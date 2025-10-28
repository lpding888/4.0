# 技术实现澄清说明

## 📋 文档目的

本文档旨在澄清项目中AI模特12分镜生成功能的技术实现方式,明确技术边界和职责划分。

## ⚠️ 重要澄清

### 之前的描述 (不准确)

在之前的项目文档中,我们使用了以下表述:

- ✗ "AI模特系统(12分镜/RunningHub集成) ✅"
- ✗ "8大核心功能模块全部实现 ✅"
- ✗ "生产就绪,可立即上线 ✅"

**问题**: 这些表述容易让人误解为我们自主开发了AI模特生成算法。

### 实际情况 (准确)

**AI模特12分镜生成的核心能力由RunningHub提供,我们实现的是业务集成。**

## 🎯 技术边界划分

### RunningHub负责的部分 (第三方API)

| 功能 | 说明 |
|------|------|
| **AI模特姿态生成** | 基于参考图生成不同姿态的模特 |
| **12分镜控制** | 自动生成12张不同分镜、角度、景别的图片 |
| **场景风格渲染** | 根据prompt描述渲染对应场景风格 |
| **模型推理** | 使用训练好的AI模型进行图像生成 |

**技术来源**: RunningHub官方工作流  
**工作流ID**: 1982694711750213634  
**API文档**: https://www.runninghub.cn/runninghub-api-doc-cn/api-279098421

### 我们负责的部分 (业务集成)

| 功能 | 说明 |
|------|------|
| **任务创建和编排** | 用户提交任务 → 创建本地任务记录 |
| **参数构建** | 根据场景和品类选择合适的Prompt模板 |
| **图片上传** | 将用户上传的图片存储到COS |
| **API调用** | 调用RunningHub官方API提交生成任务 |
| **状态轮询** | 定期查询RunningHub任务状态(3秒/次) |
| **结果拉取** | 从RunningHub获取生成的12张图片 |
| **结果存储** | 将生成的图片存储到腾讯云COS |
| **内容审核** | 对生成的图片进行合规性审核 |
| **配额管理** | 扣减和返还用户生成次数 |
| **任务管理** | 查询任务列表、详情、状态更新 |

## 💻 技术实现详解

### 1. Prompt模板设计

我们设计了9种场景×品类组合的Prompt模板:

```javascript
// backend/src/services/aiModel.service.js
this.promptTemplates = {
  street: {
    shoes: '这是一个模特拍摄,鞋子为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为街拍风格,不同运镜和角度,不同的视角和景别',
    dress: '这是一个模特拍摄,连衣裙为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为街拍风格,不同运镜和角度,不同的视角和景别',
    hoodie: '这是一个模特拍摄,卫衣为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为街拍风格,不同运镜和角度,不同的视角和景别'
  },
  studio: {
    shoes: '这是一个模特拍摄,鞋子为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为白棚摄影棚,不同运镜和角度,不同的视角和景别',
    dress: '这是一个模特拍摄,连衣裙为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为白棚摄影棚,不同运镜和角度,不同的视角和景别',
    hoodie: '这是一个模特拍摄,卫衣为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为白棚摄影棚,不同运镜和角度,不同的视角和景别'
  },
  indoor: {
    shoes: '这是一个模特拍摄,鞋子为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为室内居家环境,不同运镜和角度,不同的视角和景别',
    dress: '这是一个模特拍摄,连衣裙为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为室内居家环境,不同运镜和角度,不同的视角和景别',
    hoodie: '这是一个模特拍摄,卫衣为主题,参考图片,帮我生成12张不同分镜摆姿图片,场景为室内居家环境,不同运镜和角度,不同的视角和景别'
  }
};
```

**说明**: 这些Prompt会传递给RunningHub的节点103(文本输入)。

### 2. RunningHub API调用

```javascript
async submitToRunningHub(imageUrl, prompt) {
  // 从COS URL提取图片文件名
  const imageKey = this.extractImageKey(imageUrl);
  
  // 构建RunningHub API请求体
  const requestBody = {
    webappId: '1982694711750213634',  // RunningHub工作流ID
    apiKey: this.config.apiKey,        // API密钥
    nodeInfoList: [
      {
        nodeId: '103',                 // 文本输入节点
        fieldName: 'text',
        fieldValue: prompt,            // Prompt描述
        description: '输入提示词'
      },
      {
        nodeId: '74',                  // 图片输入节点
        fieldName: 'image',
        fieldValue: imageKey,          // 图片文件名
        description: '输入图片'
      }
    ]
  };

  // 调用RunningHub官方API
  const response = await axios.post(
    'https://www.runninghub.cn/task/openapi/ai-app/run',
    requestBody,
    {
      headers: {
        'Host': 'www.runninghub.cn',
        'Content-Type': 'application/json'
      }
    }
  );

  // 返回RunningHub任务ID
  return response.data?.data?.taskId;
}
```

### 3. 完整业务流程

```
用户操作
  ↓
1. 上传商品图片
  ↓ (COS直传)
2. 选择场景(street/studio/indoor)和品类(shoes/dress/hoodie)
  ↓
3. 点击"生成"按钮
  ↓
【我们的系统】
4. 创建本地任务记录 (status=pending)
  ↓
5. 扣减配额 (1次)
  ↓
6. 根据场景+品类选择Prompt模板
  ↓
7. 调用RunningHub API提交任务
  ↓
8. 获得RunningHub任务ID
  ↓
9. 更新本地任务状态 (status=processing)
  ↓
【RunningHub处理】
10. RunningHub执行AI生成 (1-3分钟)
   - 模特姿态生成
   - 12分镜控制
   - 场景风格渲染
  ↓
【我们的系统轮询】
11. 每3秒查询RunningHub任务状态
  ↓
12. RunningHub返回SUCCESS
  ↓
13. 拉取12张生成的图片
  ↓
14. 存储到腾讯云COS
  ↓
15. 内容审核 (腾讯云IMS)
  ↓ (通过)
16. 更新本地任务状态 (status=success)
  ↓
17. 用户查看12张结果图
```

## 📊 技术栈对比

### 完全自研的功能

| 功能 | 技术栈 |
|------|--------|
| 用户认证 | JWT + bcrypt |
| 会员系统 | MySQL事务 + 支付API |
| 配额管理 | 行级锁 + 事务 |
| 文件上传 | 腾讯云COS + STS |
| 基础修图 | 腾讯云数据万象 |
| 内容审核 | 腾讯云IMS |
| 任务管理 | Express + Knex.js |

### 第三方API集成

| 功能 | 第三方服务 | 我们的职责 |
|------|-----------|----------|
| AI模特12分镜 | RunningHub | API调用、状态轮询、结果存储 |

## 🔍 代码证据

### 代码文件头部注释

```javascript
/**
 * AI模特服务 - RunningHub API集成
 * 
 * 【重要说明】
 * 本服务集成RunningHub官方API实现AI模特12分镜生成功能。
 * - 核心生成能力: 由RunningHub提供(模特姿态、分镜、风格渲染)
 * - 我们的职责: 任务编排、参数构建、状态轮询、结果存储、配额管理
 * - API文档: https://www.runninghub.cn/runninghub-api-doc-cn/api-279098421
 * 
 * 技术实现:
 * - 使用RunningHub工作流API (webappId: 1982694711750213634)
 * - 节点103: 输入Prompt(文本描述)
 * - 节点74: 输入参考图片
 * - 生成12张不同分镜、角度、姿态的模特图
 */
```

### 环境变量配置

```bash
# .env
RUNNING_HUB_API_URL=https://www.runninghub.cn/task/openapi/ai-app/run
RUNNING_HUB_WEBAPP_ID=1982694711750213634
RUNNING_HUB_API_KEY=0e6c8dc1ed9543a498189cbd331ae85c
```

## 📝 正确的项目描述

### 功能列表 (修正后)

#### 完全自研功能 ✅
1. **用户认证系统** - 手机号验证码登录、JWT认证
2. **会员购买系统** - 支付集成、订单管理、自动开通
3. **配额管理系统** - 事务级扣减、NON-NEGATIVE保证、自动返还
4. **媒体上传系统** - COS直传、STS权限隔离、进度显示
5. **基础修图系统** - 腾讯数据万象集成(抠图+白底+增强)
6. **内容审核系统** - 腾讯云IMS集成、自动删除违规内容
7. **任务管理系统** - 任务CRUD、状态机、列表查询
8. **管理后台系统** - 用户管理、任务监控、数据统计

#### 第三方API集成 🔌
9. **AI模特12分镜生成** - RunningHub API集成
   - ✅ 任务创建和编排
   - ✅ Prompt模板管理
   - ✅ API调用封装
   - ✅ 状态轮询机制
   - ✅ 结果拉取和存储
   - ✅ 内容审核集成
   - ❌ AI模型训练 (由RunningHub提供)
   - ❌ 模特姿态生成算法 (由RunningHub提供)
   - ❌ 12分镜控制逻辑 (由RunningHub提供)

## 🎓 技术价值

虽然AI模特生成的核心算法不是我们开发的,但我们的技术价值体现在:

### 1. 完整的业务闭环
- 从用户注册、购买会员、上传图片、生成任务到结果展示的完整流程
- 配额管理、支付集成、内容审核等业务逻辑

### 2. 高质量的API集成
- 严格按照RunningHub官方API文档实现
- 完善的错误处理和容错机制
- 异步任务轮询机制(3秒间隔,最多3分钟)

### 3. 用户体验优化
- 实时进度显示
- 失败自动重试
- 配额自动返还
- 友好的错误提示

### 4. 系统稳定性
- 数据库事务保证数据一致性
- 行级锁防止并发竞争
- 超时自动清理机制
- 完整的日志系统

### 5. 安全性设计
- STS临时密钥
- 路径级别权限隔离
- 内容合规审核
- 支付签名验证

## 📚 参考文档

- [RunningHub API文档](https://www.runninghub.cn/runninghub-api-doc-cn/api-279098421)
- [腾讯云COS文档](https://cloud.tencent.com/document/product/436)
- [腾讯云数据万象文档](https://cloud.tencent.com/document/product/460)
- [腾讯云IMS文档](https://cloud.tencent.com/document/product/1125)

## ✅ 总结

**我们的定位**: SaaS平台开发者,而非AI算法研发者

**我们的价值**:
- ✅ 完整的业务系统开发
- ✅ 高质量的第三方API集成
- ✅ 用户体验优化
- ✅ 系统稳定性和安全性

**我们依赖的第三方服务**:
- RunningHub: AI模特12分镜生成
- 腾讯云COS: 对象存储
- 腾讯云数据万象: 图片处理
- 腾讯云IMS: 内容审核
- 微信支付/支付宝: 支付服务

---

**文档版本**: 1.0  
**创建时间**: 2024年  
**维护者**: AI Assistant (Qoder)
