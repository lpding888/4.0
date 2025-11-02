# API接口文档

<cite>
**本文档中引用的文件**
- [backend/src/controllers/auth.controller.js](file://backend/src/controllers/auth.controller.js)
- [backend/src/controllers/membership.controller.js](file://backend/src/controllers/membership.controller.js)
- [backend/src/controllers/task.controller.js](file://backend/src/controllers/task.controller.js)
- [backend/src/controllers/admin.controller.js](file://backend/src/controllers/admin.controller.js)
- [backend/src/routes/auth.routes.js](file://backend/src/routes/auth.routes.js)
- [backend/src/routes/membership.routes.js](file://backend/src/routes/membership.routes.js)
- [backend/src/routes/task.routes.js](file://backend/src/routes/task.routes.js)
- [backend/src/routes/admin.routes.js](file://backend/src/routes/admin.routes.js)
- [backend/src/middlewares/auth.middleware.js](file://backend/src/middlewares/auth.middleware.js)
- [backend/src/services/auth.service.js](file://backend/src/services/auth.service.js)
- [backend/src/services/membership.service.js](file://backend/src/services/membership.service.js)
- [backend/src/services/task.service.js](file://backend/src/services/task.service.js)
- [backend/src/app.js](file://backend/src/app.js)
- [frontend/src/lib/api.ts](file://frontend/src/lib/api.ts)
- [frontend/src/store/authStore.ts](file://frontend/src/store/authStore.ts)
</cite>

## 目录
1. [简介](#简介)
2. [认证机制](#认证机制)
3. [认证接口](#认证接口)
4. [会员接口](#会员接口)
5. [任务接口](#任务接口)
6. [管理接口](#管理接口)
7. [错误处理](#错误处理)
8. [调用示例](#调用示例)
9. [集成指南](#集成指南)

## 简介

本API文档详细描述了服装AI处理SaaS平台的所有公开API端点。该平台提供AI图像处理、会员订阅、任务管理和后台管理等功能。所有接口均采用RESTful设计规范，支持JSON格式的数据交换，并使用JWT进行身份认证。

### 基础信息
- **API版本**: v1
- **内容类型**: `application/json`
- **编码格式**: UTF-8
- **HTTPS**: 生产环境强制使用HTTPS

## 认证机制

### JWT Token机制

系统使用JSON Web Token (JWT) 进行用户身份认证和授权。所有需要认证的接口都需要在请求头中携带有效的JWT Token。

#### Token格式
```
Authorization: Bearer <JWT_TOKEN>
```

#### Token结构
```javascript
{
  "userId": "用户唯一标识",
  "phone": "用户手机号",
  "exp": 1704067200,    // 过期时间戳
  "iat": 1703462400     // 签发时间戳
}
```

#### 认证流程

```mermaid
sequenceDiagram
participant Client as 客户端
participant API as API服务器
participant Auth as 认证服务
participant DB as 数据库
Client->>API : 发送验证码请求
API->>Auth : 验证手机号格式
Auth->>DB : 检查发送频率限制
Auth->>Auth : 生成验证码
Auth->>DB : 保存验证码记录
Auth->>API : 返回发送结果
API->>Client : 验证码发送成功
Client->>API : 提交手机号+验证码
API->>Auth : 验证验证码
Auth->>DB : 查询用户信息
Auth->>DB : 创建新用户(如需要)
Auth->>DB : 标记验证码已使用
Auth->>Auth : 生成JWT Token
Auth->>API : 返回Token和用户信息
API->>Client : 登录成功(Token)
Client->>API : 带Token的业务请求
API->>Auth : 验证Token有效性
Auth->>API : 返回用户信息
API->>Client : 处理业务逻辑
```

**图表来源**
- [backend/src/controllers/auth.controller.js](file://backend/src/controllers/auth.controller.js#L1-L100)
- [backend/src/services/auth.service.js](file://backend/src/services/auth.service.js#L1-L220)
- [backend/src/middlewares/auth.middleware.js](file://backend/src/middlewares/auth.middleware.js#L1-L77)

**章节来源**
- [backend/src/middlewares/auth.middleware.js](file://backend/src/middlewares/auth.middleware.js#L1-L77)
- [backend/src/services/auth.service.js](file://backend/src/services/auth.service.js#L150-L180)

## 认证接口

### 发送验证码

向指定手机号发送6位数字验证码，用于用户登录或注册。

#### 接口信息
- **URL**: `/api/auth/send-code`
- **方法**: `POST`
- **认证**: 无需认证
- **速率限制**: 同一手机号每分钟最多5次，同一IP每小时最多20次

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 | 示例 |
|--------|------|------|------|------|
| phone | string | 是 | 手机号码，必须为11位中国大陆手机号 | `13800138000` |

#### 请求体结构
```json
{
  "phone": "13800138000"
}
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "expireIn": 300
  },
  "message": "验证码已发送"
}
```

**失败响应**
```json
{
  "success": false,
  "error": {
    "code": 2000,
    "message": "手机号格式错误"
  }
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 2000 | 手机号格式错误 | 400 |
| 2004 | 验证码发送过于频繁，请1分钟后再试 | 429 |
| 2005 | 请求过于频繁，请稍后再试 | 429 |

#### curl示例
```bash
curl -X POST https://api.aizhao.icu/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000"}'
```

**章节来源**
- [backend/src/controllers/auth.controller.js](file://backend/src/controllers/auth.controller.js#L10-L35)
- [backend/src/services/auth.service.js](file://backend/src/services/auth.service.js#L10-L50)

### 用户登录/注册

使用手机号和验证码进行登录或注册操作，成功后返回JWT Token和用户信息。

#### 接口信息
- **URL**: `/api/auth/login`
- **方法**: `POST`
- **认证**: 无需认证
- **速率限制**: 无

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 | 示例 |
|--------|------|------|------|------|
| phone | string | 是 | 手机号码 | `13800138000` |
| code | string | 是 | 6位数字验证码 | `123456` |

#### 请求体结构
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123456",
      "phone": "13800138000",
      "isMember": false,
      "quota_remaining": 0,
      "quota_expireAt": null
    }
  }
}
```

**失败响应**
```json
{
  "success": false,
  "error": {
    "code": 2001,
    "message": "验证码错误或已过期"
  }
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 2000 | 手机号格式错误 | 400 |
| 2001 | 验证码错误或已过期 | 400 |
| 2002 | 验证码格式错误 | 400 |

#### curl示例
```bash
curl -X POST https://api.aizhao.icu/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13800138000",
    "code": "123456"
  }'
```

**章节来源**
- [backend/src/controllers/auth.controller.js](file://backend/src/controllers/auth.controller.js#L40-L75)
- [backend/src/services/auth.service.js](file://backend/src/services/auth.service.js#L120-L180)

### 获取当前用户信息

获取当前登录用户的详细信息，需要提供有效的JWT Token。

#### 接口信息
- **URL**: `/api/auth/me`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "id": "user_123456",
    "phone": "13800138000",
    "isMember": true,
    "quota_remaining": 10,
    "quota_expireAt": "2025-02-01T00:00:00.000Z",
    "createdAt": "2024-12-01T00:00:00.000Z"
  }
}
```

**失败响应**
```json
{
  "success": false,
  "error": {
    "code": 1004,
    "message": "用户不存在"
  }
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 1001 | 未登录 | 401 |
| 1004 | 用户不存在 | 404 |

#### curl示例
```bash
curl -X GET https://api.aizhao.icu/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/auth.controller.js](file://backend/src/controllers/auth.controller.js#L80-L95)
- [backend/src/services/auth.service.js](file://backend/src/services/auth.service.js#L190-L220)

## 会员接口

### 购买会员

发起会员购买流程，返回支付所需的参数。

#### 接口信息
- **URL**: `/api/membership/purchase`
- **方法**: `POST`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 | 示例 |
|--------|------|------|------|------|
| channel | string | 是 | 支付渠道：wx(微信)或alipay(支付宝) | `wx` |

#### 请求体结构
```json
{
  "channel": "wx"
}
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "orderId": "order_123456",
    "payParams": {
      "appId": "wx123456",
      "timeStamp": "1704067200",
      "nonceStr": "abcdefg",
      "package": "prepay_id=wx123456",
      "signType": "RSA",
      "paySign": "SIGNATURE_STRING"
    }
  }
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 1001 | 未登录 | 401 |
| 5003 | 支付渠道参数错误 | 400 |

#### curl示例
```bash
curl -X POST https://api.aizhao.icu/api/membership/purchase \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"channel": "wx"}'
```

**章节来源**
- [backend/src/controllers/membership.controller.js](file://backend/src/controllers/membership.controller.js#L10-L35)
- [backend/src/services/membership.service.js](file://backend/src/services/membership.service.js#L10-L50)

### 支付回调

支付平台调用的回调接口，用于处理支付结果。

#### 接口信息
- **URL**: `/api/membership/payment-callback`
- **方法**: `POST`
- **认证**: 无需认证
- **速率限制**: 无

#### 请求体结构
```json
{
  "orderId": "order_123456",
  "transactionId": "wx123456",
  "channel": "wx",
  "amount": 9900
}
```

#### 响应格式

**成功响应**
```json
{
  "success": true
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 5002 | 订单不存在 | 404 |

#### curl示例
```bash
curl -X POST https://api.aizhao.icu/api/membership/payment-callback \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123456",
    "transactionId": "wx123456",
    "channel": "wx",
    "amount": 9900
  }'
```

**章节来源**
- [backend/src/controllers/membership.controller.js](file://backend/src/controllers/membership.controller.js#L40-L60)
- [backend/src/services/membership.service.js](file://backend/src/services/membership.service.js#L80-L130)

### 获取会员状态

获取当前用户的会员状态信息。

#### 接口信息
- **URL**: `/api/membership/status`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "isMember": true,
    "quota_remaining": 10,
    "quota_expireAt": "2025-02-01T00:00:00.000Z",
    "expireDays": 30,
    "price": 9900
  }
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 1001 | 未登录 | 401 |
| 1004 | 用户不存在 | 404 |

#### curl示例
```bash
curl -X GET https://api.aizhao.icu/api/membership/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/membership.controller.js](file://backend/src/controllers/membership.controller.js#L65-L77)
- [backend/src/services/membership.service.js](file://backend/src/services/membership.service.js#L150-L190)

## 任务接口

### 创建任务

创建新的AI图像处理任务，支持多种处理类型。

#### 接口信息
- **URL**: `/api/task/create`
- **方法**: `POST`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 | 示例 |
|--------|------|------|------|------|
| type | string | 是 | 任务类型：basic_clean(基础修图)或model_pose12(AI模特) | `basic_clean` |
| inputImageUrl | string | 是 | 输入图片的URL地址 | `https://example.com/image.jpg` |
| params | object | 否 | 任务特定参数 | `{}` |

#### 请求体结构
```json
{
  "type": "basic_clean",
  "inputImageUrl": "https://example.com/image.jpg",
  "params": {
    "enhanceLevel": 2,
    "colorCorrection": true
  }
}
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "taskId": "task_123456",
    "type": "basic_clean",
    "status": "pending",
    "createdAt": "2024-12-01T10:00:00.000Z"
  }
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 1001 | 未登录 | 401 |
| 4001 | 缺少必要参数:type和inputImageUrl | 400 |
| 4003 | 请先开通会员 | 403 |
| 4004 | 用户不存在 | 404 |

#### curl示例
```bash
curl -X POST https://api.aizhao.icu/api/task/create \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "basic_clean",
    "inputImageUrl": "https://example.com/image.jpg",
    "params": {
      "enhanceLevel": 2
    }
  }'
```

**章节来源**
- [backend/src/controllers/task.controller.js](file://backend/src/controllers/task.controller.js#L10-L60)
- [backend/src/services/task.service.js](file://backend/src/services/task.service.js#L10-L60)

### 获取任务详情

根据任务ID获取任务的详细信息。

#### 接口信息
- **URL**: `/api/task/{taskId}`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 路径参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| taskId | string | 是 | 任务唯一标识符 |

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "id": "task_123456",
    "type": "basic_clean",
    "status": "success",
    "inputImageUrl": "https://example.com/image.jpg",
    "params": {
      "enhanceLevel": 2
    },
    "resultUrls": [
      "https://example.com/result1.jpg",
      "https://example.com/result2.jpg"
    ],
    "errorMessage": null,
    "createdAt": "2024-12-01T10:00:00.000Z",
    "updatedAt": "2024-12-01T10:05:00.000Z",
    "completedAt": "2024-12-01T10:05:00.000Z"
  }
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 1001 | 未登录 | 401 |
| 4003 | 无权访问该任务 | 403 |
| 4004 | 任务不存在 | 404 |

#### curl示例
```bash
curl -X GET https://api.aizhao.icu/api/task/task_123456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/task.controller.js](file://backend/src/controllers/task.controller.js#L65-L95)
- [backend/src/services/task.service.js](file://backend/src/services/task.service.js#L70-L120)

### 获取任务列表

获取当前用户的任务列表，支持分页和筛选。

#### 接口信息
- **URL**: `/api/task/list`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 查询参数

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| limit | number | 否 | 每页数量 | 10 |
| offset | number | 否 | 偏移量 | 0 |
| status | string | 否 | 任务状态过滤 | 无 |
| type | string | 否 | 任务类型过滤 | 无 |

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_123456",
        "type": "basic_clean",
        "status": "success",
        "inputImageUrl": "https://example.com/image.jpg",
        "resultUrls": ["https://example.com/result.jpg"],
        "createdAt": "2024-12-01T10:00:00.000Z",
        "updatedAt": "2024-12-01T10:05:00.000Z",
        "completedAt": "2024-12-01T10:05:00.000Z"
      }
    ],
    "total": 25,
    "limit": 10,
    "offset": 0
  }
}
```

#### curl示例
```bash
curl -X GET "https://api.aizhao.icu/api/task/list?limit=10&offset=0&status=success&type=basic_clean" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/task.controller.js](file://backend/src/controllers/task.controller.js#L100-L130)
- [backend/src/services/task.service.js](file://backend/src/services/task.service.js#L180-L250)

### 更新任务状态

更新任务的状态信息，通常由系统内部或管理员使用。

#### 接口信息
- **URL**: `/api/task/{taskId}/status`
- **方法**: `PUT`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 路径参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| taskId | string | 是 | 任务唯一标识符 |

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| status | string | 是 | 新的任务状态 |
| resultUrls | array | 否 | 结果图片URL数组 |
| errorMessage | string | 否 | 错误信息 |

#### 请求体结构
```json
{
  "status": "success",
  "resultUrls": ["https://example.com/result.jpg"],
  "errorMessage": null
}
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "message": "任务状态更新成功"
}
```

#### 错误码

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| 1001 | 未登录 | 401 |
| 4001 | 缺少必要参数:status | 400 |

#### curl示例
```bash
curl -X PUT https://api.aizhao.icu/api/task/task_123456/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "resultUrls": ["https://example.com/result.jpg"]
  }'
```

**章节来源**
- [backend/src/controllers/task.controller.js](file://backend/src/controllers/task.controller.js#L135-L172)
- [backend/src/services/task.service.js](file://backend/src/services/task.service.js#L130-L170)

## 管理接口

### 获取用户列表

获取系统中的用户列表，支持分页和筛选。

#### 接口信息
- **URL**: `/api/admin/users`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 查询参数

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| limit | number | 否 | 每页数量 | 20 |
| offset | number | 否 | 偏移量 | 0 |
| isMember | boolean | 否 | 是否为会员 | 无 |

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_123456",
        "phone": "13800138000",
        "isMember": true,
        "quota_remaining": 10,
        "quota_expireAt": "2025-02-01T00:00:00.000Z",
        "created_at": "2024-12-01T00:00:00.000Z",
        "updated_at": "2024-12-01T10:00:00.000Z"
      }
    ],
    "total": 100,
    "limit": 20,
    "offset": 0,
    "stats": {
      "totalUsers": 1000,
      "memberUsers": 200,
      "activeMembers": 150,
      "memberRate": "20.00%"
    }
  }
}
```

#### curl示例
```bash
curl -X GET "https://api.aizhao.icu/api/admin/users?limit=20&offset=0&isMember=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/admin.controller.js](file://backend/src/controllers/admin.controller.js#L10-L50)

### 获取任务列表

获取系统中的任务列表，支持分页和筛选。

#### 接口信息
- **URL**: `/api/admin/tasks`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 查询参数

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| limit | number | 否 | 每页数量 | 20 |
| offset | number | 否 | 偏移量 | 0 |
| status | string | 否 | 任务状态过滤 | 无 |
| type | string | 否 | 任务类型过滤 | 无 |
| userId | string | 否 | 用户ID过滤 | 无 |

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_123456",
        "userId": "user_123456",
        "type": "basic_clean",
        "status": "success",
        "inputImageUrl": "https://example.com/image.jpg",
        "userPhone": "13800138000",
        "createdAt": "2024-12-01T10:00:00.000Z",
        "updatedAt": "2024-12-01T10:05:00.000Z",
        "completedAt": "2024-12-01T10:05:00.000Z"
      }
    ],
    "total": 500,
    "limit": 20,
    "offset": 0,
    "stats": {
      "totalTasks": 5000,
      "successTasks": 4000,
      "failedTasks": 500,
      "processingTasks": 500,
      "successRate": "80.00%"
    }
  }
}
```

#### curl示例
```bash
curl -X GET "https://api.aizhao.icu/api/admin/tasks?limit=20&offset=0&status=success&type=basic_clean" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/admin.controller.js](file://backend/src/controllers/admin.controller.js#L80-L130)

### 获取失败任务列表

获取系统中失败的任务列表。

#### 接口信息
- **URL**: `/api/admin/failed-tasks`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 查询参数

| 参数名 | 类型 | 必填 | 描述 | 默认值 |
|--------|------|------|------|--------|
| limit | number | 否 | 每页数量 | 20 |
| offset | number | 否 | 偏移量 | 0 |

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_123456",
        "userId": "user_123456",
        "type": "basic_clean",
        "status": "failed",
        "inputImageUrl": "https://example.com/image.jpg",
        "errorMessage": "图片格式不支持",
        "userPhone": "13800138000",
        "createdAt": "2024-12-01T10:00:00.000Z",
        "updatedAt": "2024-12-01T10:10:00.000Z"
      }
    ],
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

#### curl示例
```bash
curl -X GET "https://api.aizhao.icu/api/admin/failed-tasks?limit=20&offset=0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/admin.controller.js](file://backend/src/controllers/admin.controller.js#L140-L180)

### 获取系统概览

获取系统的整体运行统计信息。

#### 接口信息
- **URL**: `/api/admin/overview`
- **方法**: `GET`
- **认证**: 需要JWT Token
- **速率限制**: 无

#### 请求头
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": {
    "userStats": {
      "totalUsers": 1000,
      "memberUsers": 200,
      "activeMembers": 150,
      "memberRate": "20.00%"
    },
    "taskStats": {
      "totalTasks": 5000,
      "successTasks": 4000,
      "failedTasks": 500,
      "processingTasks": 500,
      "successRate": "80.00%"
    },
    "orderStats": {
      "totalOrders": 200,
      "paidOrders": 180,
      "revenue": 17820
    },
    "todayStats": {
      "newUsers": 10,
      "newTasks": 50
    }
  }
}
```

#### curl示例
```bash
curl -X GET https://api.aizhao.icu/api/admin/overview \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**章节来源**
- [backend/src/controllers/admin.controller.js](file://backend/src/controllers/admin.controller.js#L190-L252)

## 错误处理

### 统一错误响应格式

所有API接口在发生错误时都返回统一的错误响应格式：

```json
{
  "success": false,
  "error": {
    "code": 1001,
    "message": "具体的错误描述"
  }
}
```

### 错误码定义

| 错误码 | 名称 | 描述 | 使用场景 |
|--------|------|------|----------|
| 1001 | Unauthorized | 未授权 | JWT Token无效、过期或缺失 |
| 1004 | Not Found | 资源不存在 | 用户不存在、任务不存在 |
| 2000 | Invalid Phone | 手机号格式错误 | 认证接口手机号验证失败 |
| 2001 | Invalid Code | 验证码错误 | 登录时验证码验证失败 |
| 2002 | Invalid Code Format | 验证码格式错误 | 验证码长度或格式不正确 |
| 2003 | Rate Limit Exceeded | 请求频率过高 | 验证码发送过于频繁 |
| 4001 | Missing Parameters | 缺少必要参数 | 任务创建时缺少type或inputImageUrl |
| 4003 | Permission Denied | 权限不足 | 非会员用户尝试创建付费任务 |
| 4004 | Task Not Found | 任务不存在 | 获取不存在的任务详情 |
| 5002 | Order Not Found | 订单不存在 | 支付回调处理时订单不存在 |
| 5003 | Invalid Payment Channel | 支付渠道错误 | 不支持的支付渠道 |
| 9999 | Unknown Error | 未知错误 | 服务器内部错误 |

### 错误处理最佳实践

#### 前端错误处理
```typescript
// 前端API客户端错误处理示例
api.auth.login(phone, code)
  .then(response => {
    if (response.success) {
      // 登录成功，保存Token和用户信息
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
  })
  .catch(error => {
    // 根据错误码处理不同情况
    switch (error.code) {
      case 2001:
        // 显示验证码错误提示
        break;
      case 2004:
        // 显示发送频率限制提示
        break;
      case 1001:
        // 自动跳转登录页面
        localStorage.removeItem('token');
        window.location.href = '/login';
        break;
      default:
        // 显示通用错误提示
        console.error('登录失败:', error.message);
    }
  });
```

**章节来源**
- [backend/src/middlewares/auth.middleware.js](file://backend/src/middlewares/auth.middleware.js#L10-L50)
- [frontend/src/lib/api.ts](file://frontend/src/lib/api.ts#L40-L70)

## 调用示例

### 完整的用户登录流程

```mermaid
sequenceDiagram
participant User as 用户
participant Frontend as 前端应用
participant API as API服务器
participant SMS as 短信服务
participant DB as 数据库
User->>Frontend : 输入手机号
Frontend->>API : POST /auth/send-code
API->>DB : 检查发送频率限制
API->>SMS : 发送验证码短信
SMS-->>API : 发送成功
API-->>Frontend : 验证码发送成功
Frontend-->>User : 显示发送成功提示
User->>Frontend : 输入验证码
Frontend->>API : POST /auth/login
API->>DB : 验证验证码
API->>DB : 查询/创建用户
API->>DB : 标记验证码已使用
API->>API : 生成JWT Token
API-->>Frontend : 返回Token和用户信息
Frontend->>Frontend : 保存Token到localStorage
Frontend-->>User : 登录成功，跳转首页
```

**图表来源**
- [backend/src/controllers/auth.controller.js](file://backend/src/controllers/auth.controller.js#L10-L75)
- [backend/src/services/auth.service.js](file://backend/src/services/auth.service.js#L10-L180)

### 会员购买流程

```mermaid
sequenceDiagram
participant User as 用户
participant Frontend as 前端应用
participant API as API服务器
participant Payment as 支付平台
participant DB as 数据库
User->>Frontend : 点击购买会员
Frontend->>API : POST /membership/purchase
API->>DB : 创建待支付订单
API->>API : 生成支付参数
API-->>Frontend : 返回支付参数
Frontend->>Payment : 调起支付界面
Payment-->>Frontend : 支付结果
Frontend->>API : POST /membership/payment-callback
API->>DB : 验证订单状态
API->>DB : 更新订单状态
API->>DB : 开通会员权限
API-->>Frontend : 支付回调确认
Frontend-->>User : 显示购买成功
```

**图表来源**
- [backend/src/controllers/membership.controller.js](file://backend/src/controllers/membership.controller.js#L10-L77)
- [backend/src/services/membership.service.js](file://backend/src/services/membership.service.js#L10-L190)

### 任务处理流程

```mermaid
flowchart TD
Start([用户发起任务]) --> CheckMember{检查会员状态}
CheckMember --> |非会员| MemberError[返回权限错误]
CheckMember --> |会员| DeductQuota[扣减配额]
DeductQuota --> CreateTask[创建任务记录]
CreateTask --> TaskType{任务类型判断}
TaskType --> |基础修图| BasicProcess[异步处理修图]
TaskType --> |AI模特| ModelProcess[提交到AI模型]
BasicProcess --> BasicSuccess[处理完成]
ModelProcess --> ModelSuccess[AI处理完成]
BasicSuccess --> UpdateStatus[更新任务状态]
ModelSuccess --> UpdateStatus
UpdateStatus --> End([返回任务结果])
MemberError --> End
```

**图表来源**
- [backend/src/controllers/task.controller.js](file://backend/src/controllers/task.controller.js#L10-L95)
- [backend/src/services/task.service.js](file://backend/src/services/task.service.js#L10-L130)

### curl命令示例

#### 认证相关
```bash
# 发送验证码
curl -X POST https://api.aizhao.icu/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000"}'

# 用户登录
curl -X POST https://api.aizhao.icu/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13800138000",
    "code": "123456"
  }'

# 获取用户信息
curl -X GET https://api.aizhao.icu/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 会员相关
```bash
# 购买会员
curl -X POST https://api.aizhao.icu/api/membership/purchase \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "wx"}'

# 获取会员状态
curl -X GET https://api.aizhao.icu/api/membership/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 任务相关
```bash
# 创建任务
curl -X POST https://api.aizhao.icu/api/task/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "basic_clean",
    "inputImageUrl": "https://example.com/image.jpg",
    "params": {
      "enhanceLevel": 2
    }
  }'

# 获取任务列表
curl -X GET "https://api.aizhao.icu/api/task/list?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 集成指南

### 前端集成

#### 1. 安装依赖
```bash
npm install axios zustand
# 或
yarn add axios zustand
```

#### 2. 配置API客户端
```typescript
// src/lib/api.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 添加请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      }
    );

    // 添加响应拦截器
    this.client.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError) => {
        // 处理401错误，自动登出
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // API方法...
}
```

#### 3. 状态管理
```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        set({ user, token });
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      clearAuth: () => {
        set({ user: null, token: null });
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }),
    { name: 'auth-storage' }
  )
);
```

#### 4. 使用示例
```typescript
// 在组件中使用
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

function Login() {
  const { setAuth } = useAuthStore();
  
  const handleLogin = async (phone: string, code: string) => {
    try {
      const response = await api.auth.login(phone, code);
      if (response.success) {
        setAuth(response.data.user, response.data.token);
        // 跳转到首页
        router.push('/');
      }
    } catch (error) {
      console.error('登录失败:', error);
      // 显示错误提示
    }
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(phone, code);
    }}>
      {/* 表单输入 */}
    </form>
  );
}
```

### 后端集成

#### 1. JWT认证中间件
```javascript
// 中间件使用示例
const express = require('express');
const { authenticate } = require('./middlewares/auth.middleware');

const router = express.Router();

// 需要认证的路由
router.get('/protected', authenticate, (req, res) => {
  // req.userId 和 req.user 已经设置
  res.json({ message: '受保护的资源', userId: req.userId });
});
```

#### 2. 错误处理
```javascript
// 全局错误处理中间件
function errorHandler(err, req, res, next) {
  // 记录错误日志
  logger.error('API Error:', err);
  
  // 返回统一错误格式
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: err.errorCode || 9999,
      message: err.message || '服务器内部错误'
    }
  });
}
```

### 移动端集成

#### iOS (Swift)
```swift
// 使用Alamofire进行网络请求
import Alamofire

class APIService {
    static func login(phone: String, code: String, completion: @escaping (Result<LoginResponse, Error>) -> Void) {
        let url = "https://api.aizhao.icu/api/auth/login"
        let parameters: [String: Any] = [
            "phone": phone,
            "code": code
        ]
        
        AF.request(url, method: .post, parameters: parameters, encoding: JSONEncoding.default)
            .validate()
            .responseDecodable(of: LoginResponse.self) { response in
                switch response.result {
                case .success(let result):
                    completion(.success(result))
                case .failure(let error):
                    completion(.failure(error))
                }
            }
    }
}
```

#### Android (Kotlin)
```kotlin
// 使用Retrofit进行网络请求
interface ApiService {
    @POST("/auth/login")
    suspend fun login(@Body request: LoginRequest): ApiResponse<LoginResponse>
}

class LoginRepository(private val apiService: ApiService) {
    suspend fun login(phone: String, code: String): Result<LoginResponse> {
        return try {
            val response = apiService.login(LoginRequest(phone, code))
            if (response.success) {
                Result.success(response.data!!)
            } else {
                Result.failure(Exception(response.error?.message ?: "登录失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

### 测试指南

#### 单元测试示例
```javascript
// 测试认证接口
describe('Auth API', () => {
  it('should send verification code successfully', async () => {
    const response = await request(app)
      .post('/api/auth/send-code')
      .send({ phone: '13800138000' });
      
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.expireIn).toBe(300);
  });
  
  it('should reject invalid phone format', async () => {
    const response = await request(app)
      .post('/api/auth/send-code')
      .send({ phone: 'invalid-phone' });
      
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(2000);
  });
});
```

#### 集成测试示例
```javascript
// 测试完整登录流程
describe('Full Authentication Flow', () => {
  let phone = '1380013800' + Math.floor(Math.random() * 10);
  let code = '';
  
  it('should send verification code', async () => {
    const response = await request(app)
      .post('/api/auth/send-code')
      .send({ phone });
      
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  it('should get verification code from database', async () => {
    // 模拟短信服务，直接获取验证码
    const verification = await db('verification_codes')
      .where('phone', phone)
      .orderBy('created_at', 'desc')
      .first();
      
    code = verification.code;
    expect(code).toBeDefined();
  });
  
  it('should login successfully', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ phone, code });
      
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user).toBeDefined();
  });
});
```

**章节来源**
- [frontend/src/lib/api.ts](file://frontend/src/lib/api.ts#L1-L118)
- [frontend/src/store/authStore.ts](file://frontend/src/store/authStore.ts#L1-L43)
- [backend/src/app.js](file://backend/src/app.js#L1-L52)