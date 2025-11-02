# Backend Dev Skill - 项目背景(CONTEXT)

背景与"可直接落地"的工程约定

## 1. 技术栈与依赖

- **Runtime**:Node.js 18+
- **Web 框架**:Express.js
- **DB**:MySQL 8.0(字符集 utf8mb4),连接池 max=10~20
- **ORM/Query**:Knex.js(迁移/种子 + 原生 SQL 混用)
- **Cache/Queue**:Redis(缓存与速率限制);可选 bullmq(如需队列)
- **测试**:Jest + Supertest
- **文档**:OpenAPI(yaml),可选 swagger-ui-express 提供可视化
- **日志**:pino(结构化)
- **配置**:dotenv(.env)
- **部署**:PM2(3 进程,cluster 模式),Nginx 反代,宝塔管理

## 2. 目录与模块分层

- api/:仅处理路由与输入输出映射,不含业务逻辑
- services/:业务逻辑,组合多个仓储与外部服务
- repositories/:数据读写,**只返回纯数据,不掺杂 Express 对象**
- middlewares/:鉴权、RBAC、速率限制、错误处理
- utils/:通用函数、统一响应与错误码表

## 3. 配置与环境变量(示例)

```
APP_PORT=8080
NODE_ENV=production
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=cms
MYSQL_PASSWORD=secure
MYSQL_DB=cms
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=your_jwt_secret
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

## 4. 数据库基线(CMS 相关)

- content_types(id, name, slug UNIQUE, created_at, updated_at)
- content_fields(id, content_type_id FK, key, type, required, rules JSON, ... )
- content_items(id, type_id FK, version INT, status ENUM(draft,review,published), data JSON, created_by, created_at, updated_at)
- **索引**:
  - content_types.slug UNIQUE
  - content_items(type_id, status) 复合索引
  - 常用过滤字段建 BTree 索引,避免全表扫描

## 5. API 约定

- 基础路径:/api/v1
- 资源风格:复数名词(/content-types, /content-items)
- 分页:?page=1&limit=20,返回 { total, items }
- 错误码:code(整形),message(人类可读),requestId
- 健康检查:/health 返回 200 { status:"ok", ts }

## 6. 缓存与速率限制

- **缓存**:热点 GET 请求使用 Redis,键规则:cache:<route>:<hash(query)>,TTL 30~120s
- **失效**:增删改后按 type_id 或 slug 维度精确失效
- **速率限制**:IP+userId 双因子,窗口 60s,默认 100 次;登录接口更严(20 次)

## 7. 安全基线

- Helmet 安全头;CORS 白名单;JWT 鉴权;RBAC 中间件
- Joi/Zod 入参校验;Knex 参数化;审计日志(谁在何时对何资源做了什么)

## 8. 可观测性

- **日志**:pino(包含 requestId、用户ID、路由、耗时、结果码)
- **计数器**:请求数、错误率、缓存命中率(按路由)
- **Tracing(选)**:可加入 open-telemetry 简化追踪(非 MVP 必选)

## 9. 与 SCF/COS 的集成

- 直传签名:由 SCF 提供(CMS-S-001),后端只负责校验/落库策略说明
- COS 回调:提供 /webhooks/cos 接口,校验签名与幂等,写入 media 元数据并触发业务事件

## 10. 与 Provider/Quota 的对接(如有)

- 对接 Provider 前检查 **配额**:quotaCheck(userId, featureKey);成功后再调用;失败返回业务错误并记录审计
- 失败回滚:如调用失败,撤销本次扣减(由配额系统提供补偿 API;如无则记录异常并人工对账)

---

深刻理解以上背景,确保后端服务符合工程约定!
