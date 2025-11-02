# AI照后端 - Docker生产环境部署文档

艹！这是老王给你精心准备的一键部署文档，跟着走绝对不会出错！

## 📋 目录

- [系统要求](#系统要求)
- [快速部署](#快速部署)
- [详细步骤](#详细步骤)
- [SSL证书配置](#ssl证书配置)
- [数据库迁移](#数据库迁移)
- [监控和日志](#监控和日志)
- [常见问题](#常见问题)
- [运维操作](#运维操作)

---

## 🖥️ 系统要求

### 硬件配置（推荐）
- **CPU**: 4核或以上
- **内存**: 4GB或以上
- **硬盘**: 50GB或以上（SSD优先）
- **带宽**: 3Mbps或以上

### 软件环境
- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

---

## 🚀 快速部署

艹！5分钟内启动所有服务！

```bash
# 1. 克隆代码（如果还没有）
git clone <your-repo-url>
cd <your-project-directory>

# 2. 配置环境变量
cd backend
cp .env.example .env
vim .env  # 艹！必须填写真实配置，别用默认值！

# 3. 返回项目根目录
cd ..

# 4. 一键启动所有服务
docker-compose up -d

# 5. 查看服务状态
docker-compose ps

# 6. 运行数据库迁移
docker-compose exec backend npm run db:migrate

# 7. 查看日志
docker-compose logs -f backend
```

访问测试:
- **API服务**: http://your-server-ip/health
- **Swagger文档**: http://your-server-ip/api-docs
- **Prometheus指标**: http://your-server-ip/metrics

---

## 📖 详细步骤

### 步骤1: 安装Docker和Docker Compose

#### Ubuntu/Debian

```bash
# 艹！更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 艹！安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 艹！添加当前用户到docker组（免sudo）
sudo usermod -aG docker $USER
newgrp docker

# 艹！安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 艹！验证安装
docker --version
docker-compose --version
```

#### CentOS

```bash
# 艹！安装Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 艹！启动Docker
sudo systemctl start docker
sudo systemctl enable docker

# 艹！安装Docker Compose（同Ubuntu）
# ... 参考上面的命令
```

---

### 步骤2: 准备项目文件

```bash
# 艹！上传代码到服务器（使用git、scp或rsync）

# 方法1: Git克隆
git clone <your-repo-url>
cd <your-project-directory>

# 方法2: SCP上传
# 在本地执行:
# scp -r ./your-project user@server:/home/user/

# 方法3: rsync同步
# rsync -avz --exclude 'node_modules' ./your-project user@server:/home/user/
```

---

### 步骤3: 配置环境变量

艹！这一步最tm重要，千万别用默认值！

```bash
cd backend
cp .env.example .env
vim .env
```

**必须修改的配置：**

```bash
# ========== 数据库配置 ==========
DB_HOST=mysql  # 艹！Docker内部网络，保持不变
DB_USER=aiuser
DB_PASSWORD=your_strong_mysql_password_here  # 艹！改成强密码！
DB_NAME=ai_photo

# ========== JWT配置 ==========
# 艹！使用以下命令生成随机密钥
# node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
JWT_SECRET=your_generated_jwt_secret_here

# ========== 腾讯云COS配置 ==========
TENCENT_SECRET_ID=your_real_tencent_secret_id
TENCENT_SECRET_KEY=your_real_tencent_secret_key
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou
COS_IMAGE_DOMAIN=https://your-bucket.cos.ap-guangzhou.myqcloud.com

# ========== Redis配置 ==========
REDIS_HOST=redis  # 艹！Docker内部网络，保持不变
REDIS_PASSWORD=your_strong_redis_password_here

# ========== API域名 ==========
API_BASE_URL=https://aizhao.icu  # 艹！改成你的实际域名

# ========== 微信支付配置 ==========
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_PAY_MCHID=1234567890
WECHAT_PAY_SERIAL_NO=your_certificate_serial_number
WECHAT_PAY_PRIVATE_KEY=your_apiclient_key_pem_content
WECHAT_PAY_APIV3_KEY=your_apiv3_key

# ========== 支付宝配置 ==========
ALIPAY_APP_ID=2021001234567890
ALIPAY_PRIVATE_KEY=your_alipay_private_key
ALIPAY_PUBLIC_KEY=your_alipay_public_key

# ========== 加密密钥 ==========
# 艹！使用以下命令生成
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
CREDENTIALS_ENCRYPTION_KEY=your_generated_encryption_key
INTERNAL_CALLBACK_SECRET=your_generated_callback_secret

# ========== AI服务配置 ==========
RUNNINGHUB_API_KEY=your_runninghub_api_key
HUNYUAN_API_KEY=your_hunyuan_api_key
KUAI_API_KEY=your_kuai_api_key
```

---

### 步骤4: 启动Docker服务

```bash
# 艹！返回项目根目录
cd ..

# 艹！构建并启动所有服务
docker-compose up -d

# 艹！查看服务状态（应该都是Up状态）
docker-compose ps

# 预期输出:
# NAME                  IMAGE                    STATUS         PORTS
# ai-photo-backend      ai-photo-backend:latest  Up 10 seconds  0.0.0.0:3001->3001/tcp
# ai-photo-mysql        mysql:8.0                Up 20 seconds  0.0.0.0:3306->3306/tcp
# ai-photo-nginx        nginx:alpine             Up 10 seconds  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# ai-photo-redis        redis:7-alpine           Up 20 seconds  0.0.0.0:6379->6379/tcp
```

---

### 步骤5: 运行数据库迁移

```bash
# 艹！等待MySQL完全启动（大约30秒）
sleep 30

# 艹！运行数据库迁移
docker-compose exec backend npm run db:migrate

# 预期输出:
# Batch 1 run: 29 migrations
# ✅ 所有迁移成功
```

---

### 步骤6: 验证部署

```bash
# 艹！测试健康检查
curl http://localhost/health
# 预期输出: {"status":"ok","timestamp":"2025-11-02T...","env":"production"}

# 艹！测试API
curl http://localhost/api/auth/send-code -X POST -H "Content-Type: application/json" -d '{"phone":"13800138000"}'

# 艹！访问Swagger文档
# 浏览器打开: http://your-server-ip/api-docs

# 艹！查看Prometheus指标
curl http://localhost/metrics
```

---

## 🔒 SSL证书配置

### 方法1: Let's Encrypt免费证书（推荐）

```bash
# 艹！安装certbot
sudo apt-get update
sudo apt-get install -y certbot

# 艹！申请证书（需要先停止Nginx）
docker-compose stop nginx
sudo certbot certonly --standalone -d aizhao.icu -d www.aizhao.icu

# 艹！证书位置
# /etc/letsencrypt/live/aizhao.icu/fullchain.pem
# /etc/letsencrypt/live/aizhao.icu/privkey.pem

# 艹！复制证书到项目目录
sudo cp /etc/letsencrypt/live/aizhao.icu/fullchain.pem ./docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/aizhao.icu/privkey.pem ./docker/nginx/ssl/
sudo chmod 644 ./docker/nginx/ssl/*.pem

# 艹！启用HTTPS配置
vim docker/nginx/conf.d/api.conf
# 取消注释HTTPS相关配置

# 艹！重启Nginx
docker-compose up -d nginx
```

### 方法2: 自签名证书（测试用）

```bash
# 艹！生成自签名证书
mkdir -p docker/nginx/ssl
cd docker/nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=CN/ST=Guangdong/L=Shenzhen/O=AI Photo/CN=aizhao.icu"

cd ../../..

# 艹！启用HTTPS配置（同上）
```

### 自动续期（Let's Encrypt）

```bash
# 艹！添加定时任务
sudo crontab -e

# 艹！每月1号凌晨2点续期
0 2 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/aizhao.icu/*.pem /path/to/project/docker/nginx/ssl/ && docker-compose restart nginx
```

---

## 📊 监控和日志

### 查看日志

```bash
# 艹！查看所有服务日志
docker-compose logs -f

# 艹！查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f mysql
docker-compose logs -f nginx

# 艹！查看最近100行
docker-compose logs --tail=100 backend

# 艹！查看Nginx访问日志
docker-compose exec nginx tail -f /var/log/nginx/api_access.log

# 艹！查看MySQL慢查询
docker-compose exec mysql tail -f /var/log/mysql/slow.log
```

### Prometheus监控

```bash
# 艹！访问Prometheus指标
curl http://localhost/metrics

# 艹！集成Prometheus服务器
# 在prometheus.yml中添加:
scrape_configs:
  - job_name: 'ai-photo-backend'
    static_configs:
      - targets: ['your-server-ip:80']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana仪表盘（可选）

```bash
# 艹！启动Grafana
docker run -d -p 3000:3000 --name=grafana grafana/grafana

# 艹！访问Grafana
# http://your-server-ip:3000
# 默认账号: admin/admin

# 艹！添加Prometheus数据源
# 配置 -> Data Sources -> Add Prometheus
# URL: http://your-prometheus-server:9090

# 艹！导入仪表盘
# 搜索 Node.js / Express / MySQL 相关Dashboard
```

---

## 🛠️ 运维操作

### 重启服务

```bash
# 艹！重启所有服务
docker-compose restart

# 艹！重启单个服务
docker-compose restart backend
docker-compose restart mysql
docker-compose restart nginx
```

### 更新代码

```bash
# 艹！拉取最新代码
git pull

# 艹！重新构建后端镜像
docker-compose build backend

# 艹！重启后端服务
docker-compose up -d backend

# 艹！运行新的数据库迁移
docker-compose exec backend npm run db:migrate
```

### 数据库备份

```bash
# 艹！手动备份
docker-compose exec mysql mysqldump -u root -p${DB_PASSWORD} ai_photo > backup_$(date +%Y%m%d_%H%M%S).sql

# 艹！定时备份（添加到crontab）
0 2 * * * cd /path/to/project && docker-compose exec mysql mysqldump -u root -p${DB_PASSWORD} ai_photo > /path/to/backups/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql

# 艹！恢复备份
docker-compose exec -T mysql mysql -u root -p${DB_PASSWORD} ai_photo < backup_20251102_020000.sql
```

### 数据库迁移回滚

```bash
# 艹！回滚最近一次迁移
docker-compose exec backend npm run db:rollback

# 艹！回滚所有迁移
docker-compose exec backend npm run db:rollback -- --all
```

### 清理Docker资源

```bash
# 艹！清理未使用的镜像
docker image prune -a

# 艹！清理未使用的卷
docker volume prune

# 艹！清理未使用的网络
docker network prune

# 艹！一键清理所有未使用资源
docker system prune -a --volumes
```

### 停止和删除服务

```bash
# 艹！停止所有服务（保留数据）
docker-compose stop

# 艹！停止并删除容器（保留数据卷）
docker-compose down

# 艹！停止并删除所有（包括数据卷）
docker-compose down -v  # ⚠️ 危险！会删除数据库数据
```

---

## ❓ 常见问题

### 1. 服务启动失败

**问题**: `docker-compose up -d` 后服务不是Up状态

**解决**:
```bash
# 艹！查看详细日志
docker-compose logs backend

# 艹！常见原因:
# 1. 端口被占用 -> 修改docker-compose.yml的端口映射
# 2. 环境变量错误 -> 检查backend/.env文件
# 3. 数据库未就绪 -> 等待30秒再试
```

### 2. 数据库连接失败

**问题**: `Error: connect ECONNREFUSED mysql:3306`

**解决**:
```bash
# 艹！检查MySQL是否启动
docker-compose ps mysql

# 艹！查看MySQL日志
docker-compose logs mysql

# 艹！检查环境变量
docker-compose exec backend env | grep DB_

# 艹！手动测试连接
docker-compose exec backend node -e "const mysql = require('mysql2'); const conn = mysql.createConnection({host:'mysql',user:process.env.DB_USER,password:process.env.DB_PASSWORD}); conn.connect(err => console.log(err || 'Connected'));"
```

### 3. Nginx 502 Bad Gateway

**问题**: 访问API返回502错误

**解决**:
```bash
# 艹！检查后端服务是否运行
docker-compose ps backend

# 艹！检查后端健康状态
docker-compose exec backend curl http://localhost:3001/health

# 艹！查看Nginx错误日志
docker-compose logs nginx

# 艹！检查upstream配置
docker-compose exec nginx cat /etc/nginx/conf.d/api.conf
```

### 4. 内存不足

**问题**: 服务器内存占用过高

**解决**:
```bash
# 艹！查看容器内存使用
docker stats

# 艹！优化配置:
# 1. 减少MySQL buffer_pool_size (docker/mysql/my.cnf)
# 2. 减少数据库连接池 (backend/.env DATABASE_POOL_MAX)
# 3. 限制容器内存
vim docker-compose.yml
# 在backend服务添加:
# deploy:
#   resources:
#     limits:
#       memory: 800M
```

### 5. WebSocket连接失败

**问题**: 前端无法建立WebSocket连接

**解决**:
```bash
# 艹！检查Nginx WebSocket配置
docker-compose exec nginx cat /etc/nginx/conf.d/api.conf | grep -A 20 "location /socket.io"

# 艹！测试WebSocket连接
# 使用wscat工具:
npm install -g wscat
wscat -c "ws://your-server-ip/socket.io/?EIO=4&transport=websocket" -H "Authorization: Bearer your-jwt-token"
```

---

## 🎯 性能优化建议

### 1. 数据库索引优化

```sql
-- 艹！查看慢查询
docker-compose exec mysql mysql -u root -p${DB_PASSWORD} -e "SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;"

-- 艹！添加索引（如果需要）
ALTER TABLE tasks ADD INDEX idx_user_status (userId, status);
ALTER TABLE orders ADD INDEX idx_user_created (userId, created_at);
```

### 2. Redis缓存优化

```bash
# 艹！监控Redis内存
docker-compose exec redis redis-cli INFO memory

# 艹！设置内存淘汰策略
docker-compose exec redis redis-cli CONFIG SET maxmemory 256mb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 3. Nginx缓存配置

```nginx
# 艹！在api.conf中添加缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    add_header X-Cache-Status $upstream_cache_status;
    # ... 其他配置
}
```

---

## 📞 技术支持

艹！遇到问题别慌，老王我给你留了这些排查思路：

1. **查看日志**: `docker-compose logs -f`
2. **检查服务状态**: `docker-compose ps`
3. **进入容器调试**: `docker-compose exec backend sh`
4. **检查网络连接**: `docker network inspect ai-photo_ai-photo-network`
5. **重启大法**: `docker-compose restart`

---

**部署完成！** 🎉

艹！老王我这配置保证你一键部署，稳定运行！有问题随时找我！
