# 🚀 生产环境部署完整指南

> **老王说**：艹！按照这个文档一步一步来，保证你能把项目部署到生产服务器！

---

## 📋 目录

- [部署前准备](#部署前准备)
- [服务器配置](#服务器配置)
- [域名配置](#域名配置)
- [Docker环境安装](#docker环境安装)
- [SSL证书配置](#ssl证书配置)
- [项目部署](#项目部署)
- [数据库初始化](#数据库初始化)
- [验证和测试](#验证和测试)
- [监控和维护](#监控和维护)

---

## 🎯 部署前准备

### 服务器信息

- **IP地址**: 43.139.187.166
- **操作系统**: Ubuntu 20.04+ / CentOS 8+
- **最低配置**: 2核4G
- **推荐配置**: 4核8G

### 域名列表

- `aizhao.icu` - 主站
- `www.aizhao.icu` - WWW跳转
- `api.aizhao.icu` - API接口

### 需要准备的资料

- [ ] 腾讯云COS密钥（Secret ID & Secret Key）
- [ ] 微信支付商户号和密钥
- [ ] RunningHub AI API密钥
- [ ] 数据库强密码（自己生成）
- [ ] Redis密码（自己生成）
- [ ] JWT密钥（自己生成）

---

## 💻 服务器配置

### 1. SSH登录服务器

```bash
ssh root@43.139.187.166
```

### 2. 更新系统

```bash
# Ubuntu/Debian
apt update && apt upgrade -y

# CentOS/RHEL
yum update -y
```

### 3. 安装必要工具

```bash
# Ubuntu/Debian
apt install -y git curl wget vim

# CentOS/RHEL
yum install -y git curl wget vim
```

### 4. 创建项目目录

```bash
mkdir -p /opt/ai-photo
cd /opt/ai-photo
```

---

## 🌐 域名配置

### 在域名注册商后台添加DNS解析

| 类型 | 主机记录 | 记录值 | TTL |
|-----|---------|--------|-----|
| A   | @       | 43.139.187.166 | 600 |
| A   | www     | 43.139.187.166 | 600 |
| A   | api     | 43.139.187.166 | 600 |

### 验证DNS解析

```bash
# 艹！等待5-10分钟后验证
ping aizhao.icu
ping www.aizhao.icu
ping api.aizhao.icu

# 或使用nslookup
nslookup aizhao.icu
```

**⚠️ 重要：DNS解析生效后才能申请SSL证书！**

---

## 🐳 Docker环境安装

### Ubuntu/Debian

```bash
# 1. 卸载旧版本
apt remove docker docker-engine docker.io containerd runc || true

# 2. 安装依赖
apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 3. 添加Docker官方GPG密钥
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 4. 添加Docker仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. 安装Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 6. 启动Docker
systemctl start docker
systemctl enable docker

# 7. 验证安装
docker --version
docker compose version
```

### CentOS/RHEL

```bash
# 1. 卸载旧版本
yum remove docker docker-client docker-client-latest docker-common docker-latest || true

# 2. 安装依赖
yum install -y yum-utils

# 3. 添加Docker仓库
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 4. 安装Docker
yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 5. 启动Docker
systemctl start docker
systemctl enable docker

# 6. 验证安装
docker --version
docker compose version
```

---

## 🔐 SSL证书配置

### 方案一：Let's Encrypt自动化（推荐）

#### 1. 克隆项目代码

```bash
cd /opt/ai-photo
git clone <your-repo-url> .

# 或手动上传代码
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production.example .env

# 编辑配置文件
vim .env
```

**艹！必须修改以下内容**：

```bash
# 数据库密码（生成强密码）
DB_PASSWORD=$(openssl rand -base64 32)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)

# Redis密码
REDIS_PASSWORD=$(openssl rand -base64 32)

# JWT密钥
JWT_SECRET=$(openssl rand -base64 64)

# 腾讯云COS配置
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your_bucket_name

# 微信配置
WECHAT_APPID=your_appid
WECHAT_MCHID=your_mchid
WECHAT_API_V3_KEY=your_v3_key

# RunningHub AI
RUNNING_HUB_API_KEY=your_api_key

# SSL证书邮箱
SSL_EMAIL=admin@aizhao.icu
```

#### 3. 修改SSL申请脚本

```bash
vim init-letsencrypt.sh
```

修改配置：

```bash
DOMAINS=(aizhao.icu www.aizhao.icu api.aizhao.icu)
EMAIL="admin@aizhao.icu"  # 艹！改成你的邮箱
```

#### 4. 执行SSL证书申请

```bash
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh
```

**期待输出**：

```
==========================================
艹！Let's Encrypt SSL证书自动化配置
==========================================

配置信息：
域名: aizhao.icu www.aizhao.icu api.aizhao.icu
邮箱: admin@aizhao.icu
证书类型: 正式证书

确认以上信息正确？(y/N) y

1. 创建目录...
2. 下载SSL配置...
3. 生成DH参数（需要几分钟）...
4. 创建临时证书...
5. 启动Nginx...
6. 删除临时证书...
7. 申请Let's Encrypt证书...
8. 重启Nginx...

==========================================
艹！SSL证书配置完成！
==========================================
```

### 方案二：使用腾讯云证书（备选）

参见 [nginx/ssl/README.md](nginx/ssl/README.md)

---

## 📦 项目部署

### 1. 构建Docker镜像

```bash
# 艹！构建后端镜像
docker compose -f docker-compose.prod.yml build backend

# 构建前端镜像
docker compose -f docker-compose.prod.yml build frontend
```

### 2. 启动所有服务

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3. 查看服务状态

```bash
# 查看所有容器
docker compose -f docker-compose.prod.yml ps

# 期待输出（所有服务都是healthy）:
# NAME                    STATUS
# ai-photo-nginx          Up (healthy)
# ai-photo-backend        Up (healthy)
# ai-photo-frontend       Up
# ai-photo-mysql          Up (healthy)
# ai-photo-redis          Up (healthy)
# ai-photo-certbot        Up
```

### 4. 查看日志

```bash
# 查看所有日志
docker compose -f docker-compose.prod.yml logs -f

# 查看单个服务日志
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 🗄️ 数据库初始化

### 1. 进入后端容器

```bash
docker exec -it ai-photo-backend sh
```

### 2. 运行数据库迁移

```bash
# 运行所有迁移
npm run db:migrate

# 艹！应该看到成功信息
# Batch 1 run: xx migrations
```

### 3. 运行数据库种子（可选）

```bash
npm run db:seed
```

### 4. 验证数据库

```bash
# 进入MySQL容器
docker exec -it ai-photo-mysql mysql -uprod_user -p ai_photo

# 查看表
SHOW TABLES;

# 艹！应该看到所有表
# +-------------------+
# | Tables_in_ai_photo|
# +-------------------+
# | users             |
# | tasks             |
# | ...               |
# +-------------------+
```

---

## ✅ 验证和测试

### 1. 检查HTTPS证书

```bash
# 访问主站
curl -I https://aizhao.icu

# 期待输出：
# HTTP/2 200
# server: nginx
```

### 2. 检查API接口

```bash
# 健康检查
curl https://api.aizhao.icu/health

# 期待输出：
# {"status":"ok","timestamp":"2025-01-01T00:00:00.000Z"}
```

### 3. 浏览器访问

- 主站: https://aizhao.icu
- API: https://api.aizhao.icu/health

**检查SSL证书**：
- ✅ 浏览器地址栏有锁图标
- ✅ 证书有效期90天
- ✅ 颁发者：Let's Encrypt

### 4. 功能测试

按照 [docs/DELIVERY_CHECKLIST.md](docs/DELIVERY_CHECKLIST.md) 进行完整测试

---

## 📊 监控和维护

### 日常监控命令

```bash
# 查看容器状态
docker compose -f docker-compose.prod.yml ps

# 查看资源使用
docker stats

# 查看日志
docker compose -f docker-compose.prod.yml logs --tail=100 -f backend
```

### SSL证书自动续期

```bash
# 艹！Certbot容器会每12小时自动检查并续期
# 你不需要做任何事！

# 查看证书信息
docker run --rm -v "/opt/ai-photo/nginx/ssl/conf:/etc/letsencrypt" certbot/certbot certificates

# 手动强制续期（测试用）
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
docker compose -f docker-compose.prod.yml restart nginx
```

### 数据库备份

```bash
# 创建备份脚本
cat > /opt/ai-photo/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/ai-photo/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

docker exec ai-photo-mysql mysqldump \
  -uprod_user -p${DB_PASSWORD} ai_photo \
  | gzip > $BACKUP_DIR/ai_photo_$DATE.sql.gz

# 艹！只保留最近7天的备份
find $BACKUP_DIR -name "ai_photo_*.sql.gz" -mtime +7 -delete

echo "备份完成: ai_photo_$DATE.sql.gz"
EOF

chmod +x /opt/ai-photo/backup-db.sh

# 添加到crontab（每天凌晨2点备份）
echo "0 2 * * * /opt/ai-photo/backup-db.sh >> /var/log/db-backup.log 2>&1" | crontab -
```

### 更新部署

```bash
# 1. 拉取最新代码
cd /opt/ai-photo
git pull

# 2. 重新构建镜像
docker compose -f docker-compose.prod.yml build

# 3. 滚动更新（零停机）
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend

# 4. 运行数据库迁移（如果有）
docker exec -it ai-photo-backend npm run db:migrate
```

---

## 🔧 常见问题

### Q1: Nginx启动失败

```bash
# 查看日志
docker compose -f docker-compose.prod.yml logs nginx

# 常见原因：
# 1. 80/443端口被占用
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# 2. SSL证书文件不存在
ls -la nginx/ssl/aizhao.icu/
```

### Q2: 数据库连接失败

```bash
# 检查MySQL是否启动
docker compose -f docker-compose.prod.yml ps mysql

# 查看MySQL日志
docker compose -f docker-compose.prod.yml logs mysql

# 测试连接
docker exec -it ai-photo-mysql mysql -uprod_user -p
```

### Q3: SSL证书申请失败

```bash
# 检查域名解析
ping aizhao.icu

# 查看Certbot日志
docker compose -f docker-compose.prod.yml logs certbot

# 常见原因：
# 1. 域名未解析到服务器IP
# 2. 80端口未开放
# 3. Let's Encrypt API限制（每周最多5次失败）

# 解决：使用测试模式
# 在 init-letsencrypt.sh 中设置 STAGING=1
```

### Q4: 内存不足

```bash
# 查看内存使用
free -h

# 添加swap（如果物理内存<4G）
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📞 获取帮助

- **项目文档**: 查看 docs/ 目录
- **Docker文档**: [DOCKER_GUIDE.md](DOCKER_GUIDE.md)
- **Nginx配置**: [nginx/conf.d/default.conf](nginx/conf.d/default.conf)

---

## 🎉 部署完成检查清单

- [ ] 域名DNS解析正确
- [ ] Docker环境安装完成
- [ ] SSL证书配置成功
- [ ] 所有容器启动并健康
- [ ] 数据库迁移完成
- [ ] HTTPS访问正常
- [ ] API接口可用
- [ ] 前端页面加载正常
- [ ] 数据库备份脚本配置
- [ ] 监控和日志正常

**艹！全部勾选后，你的项目就成功部署了！恭喜！🎊**
