# 🐳 Docker 本地开发完整指南

> **老王说**：艹！这个指南能让你在Win11上**一键启动整个项目**，前后端+数据库+Redis全搞定！

---

## 📋 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [详细说明](#详细说明)
- [常用命令](#常用命令)
- [故障排查](#故障排查)
- [生产环境部署](#生产环境部署)

---

## 🎯 前置要求

### 1. 安装 Docker Desktop for Windows

```bash
# 1. 下载并安装 Docker Desktop
# https://www.docker.com/products/docker-desktop/

# 2. 启动 Docker Desktop

# 3. 确认安装成功
docker --version
# 输出: Docker version 24.x.x

docker-compose --version
# 输出: Docker Compose version v2.x.x
```

### 2. 确保系统要求

- ✅ Windows 11 (或 Windows 10 Pro/Enterprise)
- ✅ 启用 WSL 2 (Windows Subsystem for Linux)
- ✅ 至少 8GB 内存
- ✅ 至少 20GB 磁盘空间

---

## 🚀 快速开始

### 方式一：一键启动所有服务（推荐）

```bash
# 1. 进入项目根目录
cd "c:\Users\qq100\Desktop\迭代目录\新建文件夹 (4)"

# 2. 复制环境变量文件
cp backend/.env.dev.example backend/.env

# 3. 一键启动（包含前端、后端、MySQL、Redis、MinIO）
docker-compose -f docker-compose.dev.yml up -d

# 4. 查看日志
docker-compose -f docker-compose.dev.yml logs -f
```

**艹！就这么简单！5分钟内所有服务就起来了！**

### 启动后访问地址

| 服务 | 地址 | 说明 |
|-----|------|-----|
| 前端 | http://localhost:3001 | Next.js 开发服务器 |
| 后端API | http://localhost:3000 | Express API服务 |
| MySQL | localhost:3306 | 数据库 |
| Redis | localhost:6379 | 缓存服务 |
| MinIO控制台 | http://localhost:9001 | 对象存储管理 |

---

## 📖 详细说明

### 项目Docker架构

```
Win11 宿主机
└── Docker Desktop
    ├── ai-photo-frontend-dev (Next.js)
    ├── ai-photo-backend-dev (Express)
    ├── ai-photo-mysql-dev (MySQL 8.0)
    ├── ai-photo-redis-dev (Redis 7.0)
    └── ai-photo-minio-dev (MinIO)
```

### 文件说明

```
项目根目录/
├── backend/
│   ├── Dockerfile              # 生产环境镜像
│   ├── Dockerfile.dev          # 开发环境镜像（支持热重载）
│   ├── .dockerignore           # Docker忽略文件
│   └── .env.dev.example        # 环境变量示例
├── frontend/
│   ├── Dockerfile.dev          # 前端开发镜像
│   └── .dockerignore           # 前端忽略文件
├── docker-compose.dev.yml      # 本地开发配置
└── DOCKER_GUIDE.md            # 本文档
```

### 核心特性

#### ✅ 热重载（Hot Reload）

- **后端**: 使用 `nodemon`，修改代码自动重启
- **前端**: 使用 Next.js Fast Refresh，实时刷新页面

```bash
# 修改 backend/src/server.js 会自动重启后端
# 修改 frontend/src/app/page.tsx 会自动刷新前端
```

#### ✅ 数据持久化

```bash
# Docker会创建以下数据卷，即使删除容器数据也不会丢失
docker volume ls
# 输出:
# mysql_data      - MySQL数据库文件
# redis_data      - Redis持久化数据
# minio_data      - MinIO对象存储数据
```

#### ✅ 健康检查

```bash
# 查看容器健康状态
docker ps
# STATUS列会显示: healthy 或 unhealthy
```

---

## 🛠️ 常用命令

### 启动和停止

```bash
# 启动所有服务（后台运行）
docker-compose -f docker-compose.dev.yml up -d

# 启动单个服务
docker-compose -f docker-compose.dev.yml up -d backend

# 停止所有服务
docker-compose -f docker-compose.dev.yml down

# 停止并删除所有数据卷（⚠️ 会丢失数据库数据）
docker-compose -f docker-compose.dev.yml down -v
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.dev.yml logs -f

# 查看单个服务日志
docker-compose -f docker-compose.dev.yml logs -f backend

# 查看最近100行日志
docker-compose -f docker-compose.dev.yml logs --tail=100 backend
```

### 进入容器

```bash
# 进入后端容器
docker exec -it ai-photo-backend-dev sh

# 进入MySQL容器
docker exec -it ai-photo-mysql-dev mysql -udev_user -pdev_password ai_photo

# 进入Redis容器
docker exec -it ai-photo-redis-dev redis-cli
```

### 数据库操作

```bash
# 运行数据库迁移
docker exec -it ai-photo-backend-dev npm run db:migrate

# 运行数据库种子
docker exec -it ai-photo-backend-dev npm run db:seed

# 数据库回滚
docker exec -it ai-photo-backend-dev npm run db:rollback
```

### 重建镜像

```bash
# 代码变更后重建镜像
docker-compose -f docker-compose.dev.yml build

# 强制重建（不使用缓存）
docker-compose -f docker-compose.dev.yml build --no-cache

# 重建并重启
docker-compose -f docker-compose.dev.yml up -d --build
```

---

## 🔧 故障排查

### 问题1: 容器启动失败

```bash
# 查看容器状态
docker ps -a

# 查看失败原因
docker-compose -f docker-compose.dev.yml logs backend

# 常见原因：
# 1. 端口被占用 -> 修改docker-compose.dev.yml中的端口映射
# 2. 内存不足 -> 在Docker Desktop中增加内存限制
# 3. 环境变量缺失 -> 检查 backend/.env 文件
```

### 问题2: MySQL连接失败

```bash
# 等待MySQL健康检查通过（大约30秒）
docker-compose -f docker-compose.dev.yml logs mysql

# 手动测试连接
docker exec -it ai-photo-mysql-dev mysqladmin ping -h localhost
```

### 问题3: 热重载不工作

```bash
# Windows上可能需要额外配置
# 方案1: 在Docker Desktop -> Settings -> Resources -> File Sharing
# 添加项目目录

# 方案2: 重启容器
docker-compose -f docker-compose.dev.yml restart backend
```

### 问题4: node_modules冲突

```bash
# 删除本地node_modules
rm -rf backend/node_modules frontend/node_modules

# 重建容器
docker-compose -f docker-compose.dev.yml up -d --build
```

### 问题5: 数据卷清理

```bash
# 查看数据卷
docker volume ls

# 删除未使用的数据卷
docker volume prune

# 删除特定数据卷
docker volume rm mysql_data
```

---

## 📦 生产环境部署

### 构建生产镜像

```bash
# 后端生产镜像
cd backend
docker build -t ai-photo-backend:v1.0.0 .

# 前端生产镜像（需要先创建Dockerfile）
cd frontend
docker build -t ai-photo-frontend:v1.0.0 .
```

### 推送到镜像仓库

```bash
# 登录Docker Hub
docker login

# 打标签
docker tag ai-photo-backend:v1.0.0 username/ai-photo-backend:v1.0.0

# 推送
docker push username/ai-photo-backend:v1.0.0
```

### 服务器部署

```bash
# SSH到生产服务器
ssh root@43.139.187.166

# 拉取镜像
docker pull username/ai-photo-backend:v1.0.0

# 运行容器
docker run -d \
  --name ai-photo-backend \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  username/ai-photo-backend:v1.0.0
```

---

## 🎓 最佳实践

### 1. 开发环境

```bash
# ✅ 使用 docker-compose.dev.yml
# ✅ 挂载代码目录实现热重载
# ✅ 使用开发环境变量
# ✅ 启用详细日志
```

### 2. 生产环境

```bash
# ✅ 使用多阶段构建减小镜像体积
# ✅ 使用非root用户运行
# ✅ 配置健康检查
# ✅ 设置资源限制
# ✅ 使用环境变量管理配置
```

### 3. 安全建议

```bash
# ✅ 不要在镜像中包含敏感信息
# ✅ 使用 .dockerignore 排除不必要的文件
# ✅ 定期更新基础镜像
# ✅ 使用官方镜像或可信来源
```

---

## 🤝 常见问题 FAQ

**Q: Docker太慢怎么办？**

A:
1. 使用国内镜像加速器
2. 在Docker Desktop -> Settings -> Docker Engine中添加：
```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
```

**Q: 如何在容器间共享数据？**

A: 使用数据卷或网络文件系统（NFS）

**Q: 如何调试容器内的Node.js？**

A:
```bash
# 暴露调试端口
docker run -p 9229:9229 ...
# 使用VS Code的Docker扩展进行远程调试
```

**Q: 数据库数据如何备份？**

A:
```bash
# 导出MySQL数据
docker exec ai-photo-mysql-dev mysqldump -udev_user -pdev_password ai_photo > backup.sql

# 导入MySQL数据
docker exec -i ai-photo-mysql-dev mysql -udev_user -pdev_password ai_photo < backup.sql
```

---

## 📞 获取帮助

- **Docker官方文档**: https://docs.docker.com/
- **Docker Compose文档**: https://docs.docker.com/compose/
- **项目Issue**: 提交到项目仓库

---

**🎉 现在你可以在Win11上愉快地开发了！艹！是不是很爽？**

> 老王提醒：记得定期清理无用的镜像和容器，节省磁盘空间！
>
> ```bash
> docker system prune -a
> ```
