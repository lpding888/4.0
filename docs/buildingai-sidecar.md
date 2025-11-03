# BuildingAI Sidecar 集成文档

**版本:** 1.0.0
**更新日期:** 2025-11-03
**作者:** 老王（技术团队）

---

## 📋 概述

BuildingAI Sidecar是一个以侧车模式集成的开源AI平台，为主应用提供：
- 🤖 多厂商模型聚合（GPT-4、Claude、国产大模型等）
- 🔌 MCP工具调用（Model Context Protocol）
- 📚 RAG知识库检索
- 💰 计费与配额管理
- 🔐 统一用户体系

**集成策略：** 仅使用BuildingAI的后端服务（NestJS），不使用其前端（Nuxt），通过BFF层封装调用。

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        用户 / 前端                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    BFF 层 (Express)                          │
│  - 业务路由                                                  │
│  - 权限控制                                                  │
│  - buildingai-client.service ←─────┐                       │
└────────────────────────┬─────────────┼──────────────────────┘
                         │             │
        ┌────────────────┴──────┐      │ 内网调用
        │                       │      │ (localhost:4090)
        ▼                       ▼      │
┌──────────────────┐   ┌─────────────────────────────┐
│                  │   │  BuildingAI Sidecar         │
│  MySQL (共享)    │◄──┤  - NestJS后端               │
│  - 现有业务表    │   │  - 模型聚合                 │
│  - BuildingAI表  │   │  - MCP调用                  │
│                  │   │  - 知识库                   │
└──────────────────┘   └─────────────┬───────────────┘
                                     │
        ┌────────────────────────────┼────────────────┐
        │                            │                │
        ▼                            ▼                ▼
┌──────────────┐         ┌───────────────┐  ┌──────────────┐
│ Redis (隔离) │         │ OpenAI        │  │ 其他AI厂商   │
│ DB=1         │         │ Anthropic     │  │ 通义/文心    │
│ prefix:ba:   │         │ ...           │  │ ...          │
└──────────────┘         └───────────────┘  └──────────────┘
```

---

## 🚀 快速开始

### 前置条件

- Docker & Docker Compose 已安装
- MySQL 8.0 运行中（默认localhost:3306）
- Redis 运行中（默认localhost:6379）
- Node.js >= 18.15.0

### 1. 配置环境变量

```bash
# 复制示例配置
cp .env.buildingai.example .env.buildingai

# 编辑配置文件
vim .env.buildingai

# ⚠️ 必须修改的配置：
# - MYSQL_PASSWORD（你的MySQL密码）
# - ADMIN_PASSWORD（BuildingAI管理员密码）
# - JWT_SECRET（JWT密钥）
```

### 2. 启动侧车服务

```bash
# 进入部署目录
cd deploy/buildingai

# 启动服务（使用项目根目录的.env.buildingai）
docker-compose --env-file ../../.env.buildingai up -d

# 查看日志
docker-compose logs -f buildingai-server

# 等待2-3分钟直到服务完全启动
```

### 3. 验证服务

```bash
# 方式1：使用测试脚本（推荐）
node backend/scripts/test-buildingai-connection.js

# 方式2：手动检查
curl http://localhost:4090/api/health

# 预期输出：
# {"status":"ok","uptime":12345,"timestamp":"2025-11-03T..."}
```

### 4. 修改默认密码

```bash
# 登录BuildingAI管理后台（如需）
# 用户名：admin
# 密码：（.env.buildingai中设置的ADMIN_PASSWORD）

# ⚠️ 修改密码后请更新.env.buildingai文件
```

---

## 📁 文件结构

```
项目根目录/
├── .env.buildingai                           # 侧车环境配置
├── deploy/
│   └── buildingai/
│       └── docker-compose.yml                # 侧车Docker配置
├── backend/
│   ├── src/
│   │   └── services/
│   │       └── buildingai-client.service.ts  # BFF客户端封装
│   └── scripts/
│       └── test-buildingai-connection.js     # 连接测试脚本
└── docs/
    └── buildingai-sidecar.md                 # 本文档
```

---

## 🔧 配置说明

### Docker Compose 配置

**端口映射：**
```yaml
ports:
  - "127.0.0.1:4090:4090"  # 仅绑定localhost，不对外暴露
```

**数据库配置：**
```yaml
environment:
  - DB_TYPE=mysql           # 使用MySQL（而非默认的PostgreSQL）
  - DB_HOST=host.docker.internal  # Docker访问宿主机
  - DB_DATABASE=ai_photo    # 共享现有数据库
```

**Redis隔离：**
```yaml
environment:
  - REDIS_DB=1              # 使用DB 1（主应用使用DB 0）
  - REDIS_PREFIX=buildingai:  # 键前缀避免冲突
```

**功能开关：**
```yaml
environment:
  - DISABLE_FRONTEND=true   # 禁用Nuxt前端
  - ENABLE_CORS=false       # 禁用CORS（仅BFF调用）
  - ENABLE_SWAGGER=false    # 禁用Swagger文档
```

### 环境变量清单

| 变量名 | 说明 | 默认值 | 是否必填 |
|--------|------|--------|---------|
| `MYSQL_HOST` | MySQL主机 | localhost | ✅ |
| `MYSQL_PASSWORD` | MySQL密码 | - | ✅ |
| `ADMIN_PASSWORD` | 管理员密码 | - | ✅ |
| `JWT_SECRET` | JWT密钥 | - | ✅ |
| `REDIS_DB` | Redis数据库编号 | 1 | ❌ |
| `REDIS_PREFIX` | Redis键前缀 | buildingai: | ❌ |
| `LOG_LEVEL` | 日志级别 | info | ❌ |

---

## 🔌 BFF客户端使用

### 基础用法

```typescript
import buildingAIClient from './services/buildingai-client.service';

// 健康检查
const health = await buildingAIClient.healthCheck();
console.log(health.status); // 'ok'

// Chat接口（非流式）
const response = await buildingAIClient.chat({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7
});
console.log(response.choices[0].message.content);

// Chat接口（SSE流式）
const stream = await buildingAIClient.chatStream({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  stream: true
});

// 处理流式响应
stream.on('data', (chunk) => {
  console.log(chunk.toString());
});

// MCP工具调用
const result = await buildingAIClient.invokeMCPTool({
  tool: 'image-processing',
  parameters: {
    action: 'remove-bg',
    imageUrl: 'https://...'
  }
});

// 知识库检索
const kbResult = await buildingAIClient.queryKnowledgeBase({
  query: '如何使用该功能？',
  topK: 5
});
console.log(kbResult.chunks);
```

### Express路由集成

```typescript
// backend/src/routes/ai.route.ts
import express from 'express';
import buildingAIClient from '../services/buildingai-client.service';

const router = express.Router();

// 统一Chat接口
router.post('/chat', async (req, res, next) => {
  try {
    const { model, messages, ...options } = req.body;

    const response = await buildingAIClient.chat({
      model,
      messages,
      ...options
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// SSE流式接口
router.post('/chat/stream', async (req, res, next) => {
  try {
    const { model, messages, ...options } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await buildingAIClient.chatStream({
      model,
      messages,
      stream: true,
      ...options
    });

    stream.pipe(res);

    req.on('close', () => {
      stream.destroy();
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

## 🔒 安全配置

### 1. 端口隔离

**现状：** 4090端口仅绑定localhost
**验证：** `netstat -an | grep 4090`
**预期：** 只看到 `127.0.0.1:4090`，没有 `0.0.0.0:4090`

### 2. Nginx反代（可选）

如需通过Nginx访问：

```nginx
# docker/nginx/buildingai-proxy.conf
upstream buildingai_backend {
    server 127.0.0.1:4090;
}

server {
    listen 80;
    server_name buildingai.internal;

    # 仅内网可访问
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;

    location /api/ {
        proxy_pass http://buildingai_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # SSE支持
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }
}
```

### 3. 访问控制

**BFF层权限检查：**

```typescript
// backend/src/middlewares/buildingai-auth.ts
export function requireBuildingAIAccess(req, res, next) {
  // 检查用户是否有AI功能权限
  if (!req.user || !req.user.hasAIAccess) {
    return res.status(403).json({
      code: 'AI_ACCESS_DENIED',
      message: '需要AI功能权限'
    });
  }

  next();
}
```

---

## 🧪 测试

### 自动化测试

```bash
# 运行连接测试
node backend/scripts/test-buildingai-connection.js

# 预期输出：
# ═══════════════════════════════════════
#   BuildingAI Sidecar Connection Test
# ═══════════════════════════════════════
#
# ℹ️  Test 1: Health Check
# ✅ Health check passed
#
# ℹ️  Test 2: List Models
# ✅ Found 5 models
#
# ℹ️  Test 3: Chat Completion
# ✅ Chat completion successful
#
# ═══════════════════════════════════════
#   Test Results
# ═══════════════════════════════════════
# Total: 4
# Passed: 4
# Failed: 0
# Warnings: 0
```

### 手动测试

```bash
# 1. 健康检查
curl http://localhost:4090/api/health

# 2. 获取模型列表
curl http://localhost:4090/api/models

# 3. Chat接口（需要配置模型API Key）
curl -X POST http://localhost:4090/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## 🐛 故障排查

### 问题1：服务无法启动

**症状：** `docker-compose up -d` 后容器立即退出

**排查步骤：**
```bash
# 查看日志
docker-compose logs buildingai-server

# 常见原因：
# 1. MySQL连接失败 → 检查MYSQL_PASSWORD
# 2. Redis连接失败 → 检查REDIS_HOST
# 3. 端口被占用 → netstat -an | grep 4090
```

### 问题2：健康检查失败

**症状：** `curl http://localhost:4090/api/health` 返回502/503

**排查步骤：**
```bash
# 1. 检查容器状态
docker ps -a | grep buildingai

# 2. 检查容器日志
docker logs buildingai-sidecar

# 3. 进入容器排查
docker exec -it buildingai-sidecar sh
curl localhost:4090/api/health
```

### 问题3：数据库表冲突

**症状：** BuildingAI表与现有表名称冲突

**解决方案：**
```sql
-- 方案1：查看BuildingAI创建了哪些表
SHOW TABLES LIKE '%building%';

-- 方案2：使用独立schema（如MySQL支持）
CREATE SCHEMA buildingai;
-- 修改.env.buildingai: DB_DATABASE=buildingai

-- 方案3：修改BuildingAI表前缀（需要修改源码）
```

### 问题4：Redis键冲突

**症状：** 缓存数据错乱

**解决方案：**
```bash
# 检查Redis中的键
redis-cli
> SELECT 1
> KEYS buildingai:*

# 清理冲突键
> FLUSHDB

# 确保配置正确：
# REDIS_DB=1
# REDIS_PREFIX=buildingai:
```

---

## 📊 监控指标

### 健康检查指标

```typescript
// backend/src/routes/admin/buildingai-status.ts
router.get('/buildingai/status', async (req, res) => {
  const status = buildingAIClient.getStatus();

  res.json({
    healthy: status.healthy,
    lastCheck: status.lastHealthCheck,
    uptime: process.uptime(),
    baseURL: status.baseURL
  });
});
```

### 建议的监控项

- ✅ `/api/health` 响应时间
- ✅ BuildingAI容器CPU/内存使用率
- ✅ Chat接口P95延迟
- ✅ 错误率（4xx/5xx）
- ✅ 调用次数统计

---

## 🔄 升级与维护

### 升级BuildingAI版本

```bash
# 1. 停止当前服务
docker-compose down

# 2. 拉取最新镜像
docker pull ghcr.io/bidingcc/buildingai:latest

# 3. 重新启动
docker-compose --env-file ../../.env.buildingai up -d

# 4. 验证
node backend/scripts/test-buildingai-connection.js
```

### 备份与恢复

```bash
# 备份BuildingAI数据（在MySQL中）
mysqldump -u root -p ai_photo \
  $(mysql -u root -p -N -e "SHOW TABLES FROM ai_photo LIKE '%建building%'" | xargs) \
  > buildingai_backup.sql

# 恢复
mysql -u root -p ai_photo < buildingai_backup.sql
```

---

## 📚 参考资料

- [BuildingAI GitHub](https://github.com/BidingCC/BuildingAI)
- [BuildingAI 官方文档](https://buildingai.cc/docs)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

---

## ❓ 常见问题

### Q: 为什么不直接使用BuildingAI的前端？

**A:** 我们的主应用已有成熟的Next.js前端架构，直接复用BuildingAI前端会导致技术栈冗余和维护困难。侧车模式只使用其后端API能力，保持架构清晰。

### Q: BuildingAI和主应用的用户体系如何打通？

**A:** 通过BFF层统一认证，BuildingAI的JWT可以从主应用的用户token派生，或者通过用户ID映射实现。

### Q: 如何添加新的AI模型？

**A:** 在BuildingAI管理后台配置模型API Key，或者通过BFF层的Provider管理接口统一配置。

### Q: 性能如何？会不会成为瓶颈？

**A:** BuildingAI基于NestJS，性能良好。如遇瓶颈可以：
1. 横向扩展BuildingAI实例（多容器+负载均衡）
2. 在BFF层增加缓存
3. 对高频接口做限流

---

## 📞 支持

遇到问题？
- 查看日志：`docker-compose logs -f`
- 运行测试：`node backend/scripts/test-buildingai-connection.js`
- 联系技术团队：老王

---

**文档版本：** 1.0.0
**最后更新：** 2025-11-03
**维护者：** 老王（暴躁技术流）
