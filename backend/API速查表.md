# API速查表

艹！老王我把所有API都列出来了，需要啥直接找！

---

## 🔑 认证接口（不需要登录）

### 发送验证码
```http
POST /api/auth/send-code
Content-Type: application/json

{
  "phone": "13800138000"
}
```

### 登录/注册
```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "13800138000",
  "code": "123456"
}
```

**返回：**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "token": "eyJhbGci..."
  }
}
```

---

## 👤 用户接口（需要登录）

**所有请求都需要带Token：**
```http
Authorization: Bearer YOUR_TOKEN
```

### 获取个人信息
```http
GET /api/auth/me
```

### 更新个人信息
```http
PUT /api/users/me
Content-Type: application/json

{
  "phone": "13900139000"
}
```

---

## 🎨 任务接口（核心功能）

### 创建任务
```http
POST /api/tasks
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "featureId": "ai_fashion",
  "inputImageUrl": "https://example.com/image.jpg",
  "params": {
    "style": "casual"
  }
}
```

### 获取任务列表
```http
GET /api/tasks?page=1&limit=10
Authorization: Bearer TOKEN
```

### 获取任务详情
```http
GET /api/tasks/:taskId
Authorization: Bearer TOKEN
```

### 轮询任务状态
```http
GET /api/tasks/:taskId/status
Authorization: Bearer TOKEN
```

**返回：**
```json
{
  "status": "success",
  "resultUrls": ["https://..."]
}
```

---

## 💎 会员接口

### 获取会员套餐
```http
GET /api/membership/plans
```

### 购买会员
```http
POST /api/membership/purchase
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "planId": "monthly_99"
}
```

### 获取会员状态
```http
GET /api/membership/status
Authorization: Bearer TOKEN
```

---

## 💰 分销接口

### 成为分销商
```http
POST /api/distribution/become-distributor
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "name": "张三",
  "idCard": "110101199001011234"
}
```

### 获取分销统计
```http
GET /api/distribution/stats
Authorization: Bearer TOKEN
```

**返回：**
```json
{
  "totalReferrals": 10,
  "totalCommission": 1000,
  "availableBalance": 800
}
```

### 申请提现
```http
POST /api/distribution/withdraw
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "amount": 500,
  "account": "支付宝账号"
}
```

---

## 📢 内容接口（公开）

### 获取公告列表
```http
GET /api/announcements?page=1&limit=10
```

### 获取轮播图
```http
GET /api/banners
```

### 获取会员权益
```http
GET /api/membership-benefits
```

---

## 🔧 管理后台接口（需要admin权限）

### 获取所有用户
```http
GET /api/admin/users?page=1&limit=20
Authorization: Bearer ADMIN_TOKEN
```

### 获取所有任务
```http
GET /api/admin/tasks?status=processing
Authorization: Bearer ADMIN_TOKEN
```

### 功能配置管理
```http
GET /api/admin/features
POST /api/admin/features
PUT /api/admin/features/:id
DELETE /api/admin/features/:id
```

### Pipeline配置
```http
GET /api/admin/pipelines
POST /api/admin/pipelines
PUT /api/admin/pipelines/:id
```

---

## 📤 文件上传

### 上传图片
```http
POST /api/media/upload
Authorization: Bearer TOKEN
Content-Type: multipart/form-data

file: (binary)
```

**返回：**
```json
{
  "url": "https://cos.example.com/uploads/xxx.jpg"
}
```

---

## 🧪 开发调试接口

### 健康检查
```http
GET /health
```

### API文档（Swagger）
```http
GET /api-docs
```

---

## 📊 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未登录或Token过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 冲突（如手机号已注册） |
| 500 | 服务器错误 |

---

## 📝 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

### 失败响应
```json
{
  "success": false,
  "error": {
    "code": 2000,
    "message": "错误描述"
  }
}
```

---

## 🔐 Token使用示例

### 获取Token（登录后）
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}' \
  | jq -r '.data.token')

echo $TOKEN
```

### 使用Token访问受保护接口
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🚀 Postman Collection

**导入步骤：**
1. 打开Postman
2. Import → Raw Text
3. 粘贴以下JSON
4. 修改`{{baseUrl}}`为`http://localhost:3001`

```json
{
  "info": {
    "name": "AI衣柜API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001"
    },
    {
      "key": "token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "认证",
      "item": [
        {
          "name": "发送验证码",
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/api/auth/send-code",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"phone\":\"13800138000\"}"
            }
          }
        },
        {
          "name": "登录",
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/api/auth/login",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"phone\":\"13800138000\",\"code\":\"123456\"}"
            }
          }
        }
      ]
    }
  ]
}
```

---

## 💡 快速测试脚本

**保存为`test-api.sh`：**
```bash
#!/bin/bash

BASE_URL="http://localhost:3001"
PHONE="13800138000"

echo "1. 发送验证码..."
curl -X POST $BASE_URL/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\"}"

echo -e "\n\n请查看后端日志获取验证码，然后输入："
read CODE

echo -e "\n2. 登录..."
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")

TOKEN=$(echo $RESPONSE | jq -r '.data.token')

echo "Token: $TOKEN"

echo -e "\n3. 获取个人信息..."
curl $BASE_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**使用：**
```bash
chmod +x test-api.sh
./test-api.sh
```

---

**艹！所有API都在这了！需要啥直接抄！💪**
