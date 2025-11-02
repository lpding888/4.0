# CMS系统后端API文档

## 🚀 快速启动

### 1. 环境准备
```bash
# 复制环境变量配置
cp .env.example .env

# 编辑.env文件，配置数据库和Redis连接信息
```

### 2. 安装依赖
```bash
npm install
```

### 3. 数据库迁移
```bash
# 运行所有迁移
npm run db:migrate

# 回滚迁移（如需要）
npm run db:rollback
```

### 4. 启动服务
```bash
# 开发模式（nodemon自动重启）
npm run dev

# 生产模式
npm start

# 编译TypeScript
npm run build
```

### 5. 测试
```bash
# 运行所有测试
npm test

# 单元测试
npm run test:unit

# 测试覆盖率
npm run test:coverage
```

---

## 📡 API接口列表

### 基础
- `GET /health` - 健康检查

### 1. 公告管理 (Announcements)

**管理端：**
- `GET    /api/admin/announcements` - 列出公告
- `POST   /api/admin/announcements` - 创建公告
- `GET    /api/admin/announcements/:id` - 获取公告详情
- `PUT    /api/admin/announcements/:id` - 更新公告
- `DELETE /api/admin/announcements/:id` - 删除公告

**前台：**
- `GET /api/announcements/active` - 获取当前生效的公告

**参数说明：**
- `status`: draft | published | expired
- `position`: top | bottom | sidebar | modal
- `type`: info | warning | success | error
- `target_audience`: all | member | vip

---

### 2. 轮播图管理 (Banners)

**管理端：**
- `GET    /api/admin/banners` - 列出轮播图
- `POST   /api/admin/banners` - 创建轮播图
- `GET    /api/admin/banners/:id` - 获取轮播图详情
- `PUT    /api/admin/banners/:id` - 更新轮播图
- `DELETE /api/admin/banners/:id` - 删除轮播图
- `PUT    /api/admin/banners-sort-order` - 批量更新排序（拖拽用）

**COS上传：**
- `POST /api/admin/banners/upload-credentials` - 获取预签名上传URL（推荐）
- `POST /api/admin/banners/upload` - 后端直传（备选）

**前台：**
- `GET /api/banners/active` - 获取当前生效的轮播图

---

### 3. 会员套餐 (Membership Plans)

**管理端：**
- `GET    /api/admin/membership/plans` - 列出套餐
- `POST   /api/admin/membership/plans` - 创建套餐
- `GET    /api/admin/membership/plans/:id` - 获取套餐详情（含权益）
- `PUT    /api/admin/membership/plans/:id` - 更新套餐
- `DELETE /api/admin/membership/plans/:id` - 删除套餐
- `PUT    /api/admin/membership/plans/:id/benefits` - 批量设置套餐权益

**前台：**
- `GET /api/membership/plans` - 获取所有激活套餐（含权益）
- `GET /api/membership/plans/slug/:slug` - 根据slug获取套餐

---

### 4. 会员权益 (Membership Benefits)

**管理端：**
- `GET    /api/admin/membership/benefits` - 列出权益
- `POST   /api/admin/membership/benefits` - 创建权益
- `GET    /api/admin/membership/benefits/:id` - 获取权益详情
- `PUT    /api/admin/membership/benefits/:id` - 更新权益
- `DELETE /api/admin/membership/benefits/:id` - 删除权益

**前台：**
- `GET /api/membership/benefits` - 获取所有激活权益

**权益类型：**
- `feature` - 功能权益
- `quota` - 配额权益
- `service` - 服务权益
- `discount` - 折扣权益

---

### 5. 文案配置 (Content Texts)

**管理端：**
- `GET    /api/admin/content/texts` - 列出文案
- `POST   /api/admin/content/texts` - 创建文案
- `GET    /api/admin/content/texts/:id` - 获取文案详情
- `PUT    /api/admin/content/texts/:id` - 更新文案
- `DELETE /api/admin/content/texts/:id` - 删除文案
- `POST   /api/admin/content/texts/batch` - 批量导入/更新

**前台：**
- `GET /api/content/texts/:page?language=zh-CN` - 获取页面文案

**文案组织结构：**
```
page: 页面标识（如 "home", "workspace"）
section: 区块标识（可选，如 "header", "footer"）
key: 文案键
language: 语言代码（zh-CN, en-US等）
value: 文案内容
```

**返回格式：**
```json
{
  "section1": {
    "key1": "value1",
    "key2": "value2"
  },
  "key3": "value3"  // 无section的直接放根级别
}
```

---

### 6. 审计日志 (Audit Logs)

**管理端：**
- `GET /api/admin/audit-logs` - 列出审计日志
- `GET /api/admin/audit-logs/:id` - 获取日志详情
- `GET /api/admin/audit-logs/entity/:entity_type/:entity_id` - 获取实体操作历史
- `GET /api/admin/audit-logs/user/:user_id` - 获取用户操作历史

**查询参数：**
- `entity_type`: announcement | banner | plan | benefit | content_text
- `action`: create | update | delete | publish | unpublish | approve | reject
- `start_date`, `end_date`: 时间范围

---

### 7. 批量导入导出 (Import/Export)

**管理端：**
- `GET  /api/admin/export/:entityType?format=json|csv` - 导出数据
- `POST /api/admin/import/content-texts` - 导入文案

**支持导出的实体类型：**
- `content_texts` - 文案配置
- `announcements` - 公告
- `banners` - 轮播图
- `plans` - 会员套餐
- `benefits` - 会员权益

**导入文案示例：**
```json
{
  "data": [
    {
      "page": "home",
      "section": "hero",
      "key": "title",
      "language": "zh-CN",
      "value": "欢迎使用",
      "description": "首页大标题"
    }
  ],
  "format": "json"
}
```

---

## 🔧 数据库表结构

### 核心表
1. `announcements` - 公告
2. `banners` - 轮播图
3. `membership_plans` - 会员套餐
4. `membership_benefits` - 会员权益
5. `plan_benefits` - 套餐权益关联
6. `content_texts` - 文案配置
7. `audit_logs` - 审计日志

---

## 🕐 定时任务

系统自动启动以下定时任务（每分钟执行一次）：

1. **公告调度器**
   - 自动发布到期的公告（draft -> published）
   - 自动下线过期的公告（published -> expired）

2. **轮播图调度器**
   - 自动发布到期的轮播图（draft -> published）
   - 自动下线过期的轮播图（published -> expired）

---

## 📝 响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "错误描述"
  }
}
```

---

## 🔐 认证（待实现）

当前所有/admin路由需要添加认证中间件。

---

## 📊 测试覆盖率

- 单元测试：~95个测试用例
- 覆盖率：≥80%
- 所有测试通过率：100%

---

## 🛠️ 技术栈

- **框架**: Express.js + TypeScript
- **数据库**: MySQL 8 + Knex.js
- **缓存**: Redis + LRU
- **存储**: 腾讯云COS
- **测试**: Jest
- **加密**: AES-256-GCM

