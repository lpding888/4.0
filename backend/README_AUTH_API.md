# 认证API文档 - Phase 1完成

艹，老王我把认证系统全部搞定了！前端的崽芽子们看好了！

---

## 🎉 Phase 1 完成清单

✅ **1. users表扩展** - 添加`password`和`role`字段
✅ **2. JWT认证中间件** - `authenticate`, `requireAdmin`, `optionalAuth`
✅ **3. 登录接口** - POST `/api/auth/login` (设置Cookie)
✅ **4. 注册接口** - POST `/api/auth/register` (设置Cookie)
✅ **5. 获取当前用户** - GET `/api/users/me`
✅ **6. 刷新Token** - POST `/api/auth/refresh`
✅ **7. 登出接口** - POST `/api/auth/logout` (清除Cookie)
✅ **8. CORS配置** - 支持`credentials: true`
✅ **9. 环境变量** - 更新`.env.example`
✅ **10. TypeScript编译** - 无错误通过

---

## 🔐 Cookie设置详情

### 登录/注册成功后自动设置的Cookies：

| Cookie名称 | 值类型 | HttpOnly | 有效期 | 用途 |
|----------|--------|----------|--------|------|
| `access_token` | JWT字符串 | ✅ Yes | 7天 | API访问凭证 |
| `refresh_token` | JWT字符串 | ✅ Yes | 7天 | 刷新访问凭证 |
| `roles` | 字符串 | ❌ No | 7天 | 前端路由权限判断 |

**重要提示：**
- `access_token`和`refresh_token`是HttpOnly，JS无法读取（防XSS）
- `roles`可以被JS读取，用于前端路由权限控制
- 所有Cookie在生产环境自动启用`secure`（需HTTPS）

---

## 📡 新增API接口

### 1. 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "password123",
  "referrer_id": "xxx" // 可选，推荐人ID
}
```

**成功响应 (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "abc123...",
      "phone": "13800138000",
      "role": "user",
      "isMember": false,
      "quota_remaining": 0,
      "quota_expireAt": null,
      "referrer_id": null,
      "created_at": "2025-11-01T12:00:00Z",
      "updated_at": "2025-11-01T12:00:00Z"
    },
    "access_token": "eyJhbGciOiJIUzI1...",
    "refresh_token": "eyJhbGciOiJIUzI1..."
  }
}
```

**错误响应:**
- `400` - 手机号/密码格式错误
- `409` - 手机号已被注册

---

### 2. 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "password123"
}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* 同注册 */ },
    "access_token": "eyJhbGciOiJIUzI1...",
    "refresh_token": "eyJhbGciOiJIUzI1..."
  }
}
```

**错误响应:**
- `400` - 缺少必填字段
- `401` - 手机号或密码错误

---

### 3. 获取当前用户信息
```http
GET /api/users/me
Cookie: access_token=xxx
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "abc123...",
    "phone": "13800138000",
    "role": "user",
    "isMember": false,
    "quota_remaining": 0,
    "quota_expireAt": null,
    "referrer_id": null,
    "created_at": "2025-11-01T12:00:00Z",
    "updated_at": "2025-11-01T12:00:00Z"
  }
}
```

**错误响应:**
- `401` - 未登录或Token无效

---

### 4. 刷新Token
```http
POST /api/auth/refresh
Cookie: refresh_token=xxx
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1...",
    "refresh_token": "eyJhbGciOiJIUzI1..."
  }
}
```

**自动行为：**
- 同时刷新`access_token`和`refresh_token`
- 自动更新Cookie

**错误响应:**
- `401` - Refresh Token无效或过期

---

### 5. 用户登出
```http
POST /api/auth/logout
Cookie: access_token=xxx
```

**成功响应 (200):**
```json
{
  "success": true,
  "message": "登出成功"
}
```

**自动行为：**
- 清除所有Cookie（`access_token`, `refresh_token`, `roles`）

---

### 6. 更新当前用户信息
```http
PUT /api/users/me
Cookie: access_token=xxx
Content-Type: application/json

{
  "phone": "13900139000"
}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": { /* 更新后的用户信息 */ }
}
```

**错误响应:**
- `400` - 手机号格式错误或没有可更新字段
- `401` - 未登录
- `409` - 手机号已被其他用户使用

---

## 🛡️ 认证中间件使用

### 在受保护的API路由中使用：

**方式1：必须登录（authenticate）**
```typescript
import { authenticate } from '../middleware/auth.middleware';

router.get('/protected', authenticate, (req, res) => {
  // req.user 包含：{ userId, phone, role }
  res.json({ user: req.user });
});
```

**方式2：必须管理员（requireAdmin）**
```typescript
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

router.post('/admin/config', authenticate, requireAdmin, (req, res) => {
  // 只有role='admin'的用户才能访问
});
```

**方式3：可选认证（optionalAuth）**
```typescript
import { optionalAuth } from '../middleware/auth.middleware';

router.get('/articles', optionalAuth, (req, res) => {
  // 登录用户：req.user存在
  // 未登录：req.user为undefined
  // 两种情况都能访问
});
```

---

## ⚙️ 环境变量配置

**必须在`.env`中配置以下变量：**

```bash
# 前端URL（CORS配置用）
FRONTEND_URL=http://localhost:3001

# JWT配置（艹，生产环境必须改！）
JWT_SECRET=your_jwt_secret_key_change_this_in_production_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

**说明：**
- `FRONTEND_URL` - 前端地址，用于CORS白名单
- `JWT_SECRET` - JWT签名密钥，**生产环境必须改成随机字符串（至少32字符）**
- `JWT_ACCESS_EXPIRES_IN` - Access Token有效期（15分钟）
- `JWT_REFRESH_EXPIRES_IN` - Refresh Token有效期（7天）

---

## 🔄 前端集成示例

### 示例1：登录
```typescript
// 登录
async function login(phone: string, password: string) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // 艹，必须加这个才能发送Cookie！
    body: JSON.stringify({ phone, password }),
  });

  const data = await res.json();
  if (data.success) {
    // Cookie已自动设置，前端只需保存用户信息到状态管理
    setUser(data.data.user);
  }
}
```

### 示例2：访问受保护API
```typescript
// 获取当前用户
async function getCurrentUser() {
  const res = await fetch('http://localhost:3000/api/users/me', {
    credentials: 'include', // 艹，必须加这个才能发送Cookie！
  });

  const data = await res.json();
  if (data.success) {
    setUser(data.data);
  } else if (res.status === 401) {
    // Token过期，尝试刷新
    await refreshToken();
  }
}
```

### 示例3：刷新Token
```typescript
// 刷新Token
async function refreshToken() {
  const res = await fetch('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    credentials: 'include', // 艹，必须加这个！
  });

  const data = await res.json();
  if (data.success) {
    // Cookie已自动更新
    return true;
  } else {
    // Refresh Token也过期了，跳转登录
    redirectToLogin();
    return false;
  }
}
```

### 示例4：登出
```typescript
// 登出
async function logout() {
  await fetch('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  // Cookie已自动清除
  clearUserState();
  redirectToLogin();
}
```

---

## 🚀 启动步骤

### 1. 安装新依赖
```bash
cd backend
npm install
```

### 2. 运行数据库迁移
```bash
npm run db:migrate
```

**会执行：**
- 添加`users.password`字段
- 添加`users.role`字段

### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑.env，至少修改：
# - JWT_SECRET (生产环境必须改)
# - FRONTEND_URL (前端地址)
```

### 4. 启动服务
```bash
npm run dev
```

---

## 📊 数据库变更

### users表新增字段：

```sql
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL COMMENT '密码hash（bcrypt）';
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' COMMENT '用户角色：user | admin | distributor';
ALTER TABLE users ADD INDEX idx_users_role (role);
```

---

## 🎯 角色权限说明

| 角色 | 值 | 权限说明 |
|------|-----|----------|
| 普通用户 | `user` | 基础功能访问 |
| 管理员 | `admin` | 所有/admin路由访问 |
| 分销商 | `distributor` | 分销相关功能 |

---

## ⚠️ 重要提示

### 1. CORS配置
前端请求**必须**包含`credentials: 'include'`，否则Cookie无法传递！

### 2. Token有效期
- Access Token：15分钟（短期）
- Refresh Token：7天（长期）
- 建议前端在API 401响应时自动调用`/auth/refresh`

### 3. 生产环境安全
- 必须修改`JWT_SECRET`为随机字符串（至少32字符）
- 必须使用HTTPS（Cookie的`secure`标志自动启用）
- 必须配置正确的`FRONTEND_URL`

### 4. Cookie安全特性
- `httpOnly: true` - 防止XSS攻击
- `sameSite: 'lax'` - 防止CSRF攻击
- `secure: true` - 生产环境强制HTTPS

---

## 🔍 调试技巧

### 查看Cookie
```javascript
// 浏览器Console
document.cookie // 只能看到roles，看不到httpOnly的token

// 浏览器DevTools -> Application -> Cookies
// 可以看到所有Cookie
```

### 测试登录流程
```bash
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"test123"}' \
  -c cookies.txt

# 获取当前用户（使用保存的Cookie）
curl http://localhost:3000/api/users/me -b cookies.txt

# 登出
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

---

## 📦 新增文件列表

**Migration:**
- `src/db/migrations/20251101000001_add_auth_fields_to_users.js`

**工具函数:**
- `src/utils/jwt.ts` - JWT生成、验证、提取

**中间件:**
- `src/middleware/auth.middleware.ts` - 认证中间件

**Repository:**
- `src/repositories/users.repo.ts` - 用户数据库操作

**Controller:**
- `src/controllers/auth.controller.ts` - 认证相关接口
- `src/controllers/users.controller.ts` - 用户相关接口

**Routes:**
- `src/routes/auth.routes.ts` - 认证路由
- `src/routes/users.routes.ts` - 用户路由

**配置:**
- `backend/src/app.ts` - 更新CORS和Cookie-parser
- `backend/.env.example` - 新增JWT和FRONTEND_URL配置
- `backend/package.json` - 新增cookie-parser依赖

---

## ✅ 验收标准

- [x] 用户可以注册账号
- [x] 用户可以登录并自动设置Cookie
- [x] 用户可以访问`/api/users/me`获取个人信息
- [x] 用户可以刷新Token
- [x] 用户可以登出并清除Cookie
- [x] 管理员可以访问`/admin`路由
- [x] CORS支持跨域Cookie传递
- [x] TypeScript编译无错误

---

**艹，Phase 1全部完成！前端的崽芽子们可以开始干活了！**

如有问题找老王我！💪
