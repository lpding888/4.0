# 本地开发环境快速搭建指南

## 🚀 使用Docker一键启动测试环境

### 前置条件
- 已安装 Docker Desktop（Windows/Mac）
- 已安装 Node.js 18+

### 步骤1：启动Docker容器

在项目根目录执行：

```bash
# 启动MySQL和Redis容器
docker-compose -f docker-compose.dev.yml up -d

# 查看容器状态
docker-compose -f docker-compose.dev.yml ps

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f
```

**等待约10秒，直到MySQL健康检查通过！**

### 步骤2：复制Docker环境变量

```bash
cd backend
cp .env.docker .env
```

### 步骤3：执行数据库迁移

```bash
npm run db:migrate
```

**预期输出**：
```
✓ feature_definitions表创建成功
✓ form_schemas表创建成功
✓ pipeline_schemas表创建成功
✓ tasks表扩展成功
✓ task_steps表创建成功
✓ provider_endpoints表创建成功
✓ provider_health表创建成功
✓ assets表创建成功
```

### 步骤4：验证迁移结果

```bash
# 连接到MySQL容器
docker exec -it ai-photo-mysql-dev mysql -uroot -pdev_password_123 ai_photo

# 查看所有表
SHOW TABLES;

# 查看feature_definitions表结构
DESC feature_definitions;

# 退出MySQL
exit
```

### 步骤5：启动后端服务

```bash
npm run dev
```

---

## 🧹 测试完成后清理

```bash
# 停止并删除容器（保留数据卷）
docker-compose -f docker-compose.dev.yml down

# 停止并删除容器+数据卷（完全清理）
docker-compose -f docker-compose.dev.yml down -v
```

---

## 📊 容器信息

### MySQL
- **主机**: localhost
- **端口**: 3306
- **数据库**: ai_photo
- **用户**: root
- **密码**: dev_password_123

### Redis
- **主机**: localhost
- **端口**: 6379
- **密码**: 无

---

## ⚠️ 常见问题

### 1. 端口被占用
```bash
# 修改 docker-compose.dev.yml 中的端口映射
# 例如：将 "3306:3306" 改为 "3307:3306"
```

### 2. MySQL连接失败
```bash
# 等待10-15秒让MySQL完全启动
docker-compose -f docker-compose.dev.yml logs mysql

# 查看健康检查状态
docker ps
```

### 3. 迁移执行失败
```bash
# 检查.env配置是否正确
cat backend/.env

# 手动回滚迁移
npm run db:rollback

# 重新执行迁移
npm run db:migrate
```

---

## 🎯 下一步

1. ✅ 数据库迁移完成
2. 📝 开始实现业务逻辑（Feature Service、PipelineEngine等）
3. 🧪 编写单元测试
4. 🚀 部署到服务器

---

**注意**：此Docker环境仅用于本地开发测试，生产环境请使用专业的数据库服务！
