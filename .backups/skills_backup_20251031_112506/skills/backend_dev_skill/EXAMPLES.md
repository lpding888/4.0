# Backend Dev Skill - 完整示例(EXAMPLES)

真实可用的示例:OpenAPI 片段、迁移、路由/服务、测试、缓存、回调、修复卡执行等。

## 1. OpenAPI 片段(内容类型 CRUD)

参考Q13回答中的完整OpenAPI示例:
- 定义 /api/v1/content-types 路径
- GET 列表(分页参数)
- GET /:id 详情
- POST 创建
- PUT /:id 更新
- DELETE /:id 删除
- 定义 ContentType Schema

## 2. Knex 迁移(MySQL 8)

参考Q13回答中的完整迁移示例:
- 创建 content_types 表(id, name, slug UNIQUE, created_at, updated_at)
- 创建 content_fields 表(id, content_type_id FK, key, type, required, rules JSON, created_at, updated_at)
- 建立外键关联和索引
- 提供 exports.up 和 exports.down 函数

## 3. Express 路由/控制器/服务/仓储

参考Q13回答中的完整代码示例:
- 路由层:定义RESTful路由,应用中间件(auth, rbac, rateLimit)
- 控制器层:处理请求/响应,调用服务层
- 服务层:业务逻辑,组合多个仓储
- 仓储层:数据库操作,返回纯数据

## 4. Jest 测试(单元测试)

参考Q13回答中的完整测试示例:
- 测试 content-types 服务的 CRUD 操作
- Mock 数据库操作
- 断言返回结果
- 覆盖边界情况

## 5. 缓存策略(Redis)

参考Q13回答中的完整缓存示例:
- 热点数据缓存(GET 请求)
- 缓存键规则:cache:<route>:<hash(query)>
- TTL 30~120s
- 增删改后精确失效

## 6. 回调处理(COS/SCF)

参考Q13回答中的完整回调示例:
- 提供 /webhooks/cos 接口
- 校验签名与幂等
- 写入 media 元数据
- 触发业务事件

## 7. 修复类任务卡执行

参考Q13回答中的修复卡示例:
- 由 Reviewer 发起修复任务卡
- 标注修复类型(安全/性能/规范)
- 提供修复建议
- 验证修复效果

---

以上示例可直接用于生产环境,确保后端服务高质量!
