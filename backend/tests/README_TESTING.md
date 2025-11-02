# 测试指南 - 无需账号密码！

艹，老王我告诉你：**测试根本不需要真实账号密码！** 有两种测试方案：

---

## 🚀 方案1：纯Mock测试（推荐，无需数据库）

### 文件位置
`tests/unit/services/pipelineEngine.mock.test.js`

### 特点
✅ **完全Mock，不需要数据库**
✅ **不需要启动Docker Desktop**
✅ **不需要任何真实账号密码**
✅ **运行速度快**
✅ **随时可以运行**

### 运行方式
```bash
cd backend

# 只运行Mock测试
npm test -- pipelineEngine.mock.test.js
```

### 工作原理
```javascript
// Mock数据库
jest.mock('../../../src/config/database', () => ({
  knex: jest.fn()
}));

// Mock Provider
jest.mock('../../../src/providers/provider-loader', () => ({
  providerLoader: {
    loadProvider: jest.fn((type) => {
      return Promise.resolve({
        name: `Mock${type}Provider`,
        execute: jest.fn(async () => {
          return { success: true, data: { result: '成功' } };
        })
      });
    })
  }
}));
```

**艹！所有依赖都是假的，完全不需要真实环境！**

---

## 🗃️ 方案2：集成测试（需要测试数据库）

### 文件位置
`tests/unit/services/pipelineEngine.service.test.js`

### 特点
✅ **测试更真实（使用真实数据库）**
⚠️ **需要启动MySQL（测试库）**
⚠️ **需要运行migration**

### 测试账号自动创建

**不需要真实账号！** 测试框架会自动创建：

```javascript
// tests/setup.js 第38-51行
global.createTestUser = async (overrides = {}) => {
  const defaultUser = {
    id: 'test-user-id',
    phone: '13800138000',  // 假的手机号
    password: 'test123',    // 假的密码
    isMember: true,
    quota_remaining: 10,
    // ...
  };
  await knex('users').insert(user);
  return user;
};

global.createTestTask = async (userId, overrides = {}) => {
  const defaultTask = {
    id: 'test-task-id',
    userId,
    type: 'video_generate',
    status: 'pending',
    // ...
  };
  await knex('tasks').insert(task);
  return task;
};
```

**每个测试运行时：**
1. 自动创建测试用户（假数据）
2. 自动创建测试任务（假数据）
3. 运行测试
4. 自动清理所有数据

### 运行步骤

#### 步骤1：启动测试数据库

```bash
# 启动Docker Desktop

# 启动MySQL
cd "C:\Users\qq100\Desktop\迭代目录\新建文件夹 (4)"
docker-compose -f docker-compose.dev.yml up -d mysql

# 等待MySQL启动完成
docker ps  # 检查状态为healthy
```

#### 步骤2：创建测试数据库

```bash
# 连接MySQL
docker exec -it ai-photo-mysql-dev mysql -uroot -pdev_password_123

# 创建测试库
CREATE DATABASE IF NOT EXISTS test_ai_photo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

#### 步骤3：运行测试Migration

```bash
cd backend

# 设置测试环境
export NODE_ENV=test
export DB_NAME=test_ai_photo

# 运行migration
npm run db:migrate
```

#### 步骤4：运行集成测试

```bash
npm test -- pipelineEngine.service.test.js
```

---

## 📊 两种方案对比

| 特性 | 方案1：Mock测试 | 方案2：集成测试 |
|------|----------------|----------------|
| **需要数据库** | ❌ 不需要 | ✅ 需要测试库 |
| **需要账号密码** | ❌ 不需要 | ❌ 不需要（自动创建） |
| **运行速度** | ⚡ 极快 | 🐢 较慢 |
| **测试真实性** | 📝 基础验证 | 🔍 完整验证 |
| **适用场景** | 快速验证逻辑 | 上线前完整测试 |

---

## 🎯 推荐策略

### 日常开发（方案1）
```bash
# 快速验证代码逻辑
npm test -- pipelineEngine.mock.test.js
```

### 上线前验证（方案2）
```bash
# 启动数据库
docker-compose -f docker-compose.dev.yml up -d mysql

# 运行完整测试
npm test
```

---

## ❓ 常见问题

### Q1: 我没有真实用户账号怎么办？
**A:** 艹！根本不需要！测试会自动创建假用户：
```javascript
const testUser = await global.createTestUser({
  phone: '13800138000',  // 假号码
  password: 'test123'     // 假密码
});
```

### Q2: 测试数据会污染生产库吗？
**A:** 不会！测试使用独立的`test_ai_photo`数据库（setup.js第10行）

### Q3: 运行测试后数据会残留吗？
**A:** 不会！每个测试后自动清理（setup.js第16-29行）

### Q4: Mock测试能验证FORK/JOIN吗？
**A:** 能！Mock测试验证：
- ✅ FORK并行启动逻辑
- ✅ JOIN策略处理逻辑
- ✅ 错误隔离机制
- ✅ 数据库操作调用

### Q5: 我不想启动Docker怎么办？
**A:** 用方案1！完全不需要Docker：
```bash
npm test -- pipelineEngine.mock.test.js
```

---

## 🔥 快速开始（零配置）

**艹！就这一行命令：**

```bash
cd backend && npm test -- pipelineEngine.mock.test.js
```

**不需要：**
- ❌ 启动Docker
- ❌ 启动MySQL
- ❌ 真实账号密码
- ❌ 运行migration

**直接运行，马上看到结果！**

---

## 📝 测试覆盖

### Mock测试覆盖（pipelineEngine.mock.test.js）
- ✅ FORK并行启动所有分支
- ✅ JOIN策略：ALL（所有分支成功）
- ✅ JOIN策略：ANY（任一分支成功）
- ✅ 错误隔离机制
- ✅ 向后兼容（旧格式steps数组）

### 集成测试覆盖（pipelineEngine.service.test.js）
- ✅ 真实数据库操作
- ✅ task_steps记录创建
- ✅ 任务状态更新
- ✅ Provider实际调用

---

## 🎉 总结

艹！老王我再强调一遍：

**测试不需要真实账号密码！**

- **方案1（推荐）**：完全Mock，零配置，随时运行
- **方案2**：需要数据库，但测试用户自动创建（假数据）

**现在就可以运行：**
```bash
cd backend
npm test -- pipelineEngine.mock.test.js
```

**如有问题找老王我！💪**
