# 宝塔面板部署指南 - AI照片后端

老王我给你整理的完整部署流程，按步骤来，绝对没问题！

---

## 📋 部署前准备

### 1. 服务器要求
- **系统**: CentOS 7+ / Ubuntu 18.04+
- **内存**: 至少2GB
- **Node.js**: 16.x 或 18.x
- **MySQL**: 8.0+
- **Redis**: 6.0+
- **宝塔面板**: 7.x+

### 2. 宝塔面板需要安装的软件
```
✅ Nginx 1.22+
✅ MySQL 8.0+
✅ Redis 6.0+
✅ PM2管理器
✅ Node.js 18.x (通过宝塔软件商店安装)
```

---

## 🚀 部署步骤

### 步骤1: 在宝塔创建网站

1. 登录宝塔面板
2. 点击 **网站** → **添加站点**
3. 填写配置:
   ```
   域名: api.aizhao.icu  (或你的域名)
   根目录: /www/wwwroot/ai-photo-backend
   PHP版本: 纯静态
   ```
4. 点击提交

### 步骤2: 上传代码

#### 方式A: Git拉取(推荐)
```bash
cd /www/wwwroot
git clone <你的仓库地址> ai-photo-backend
cd ai-photo-backend/backend
```

#### 方式B: 手动上传
1. 将整个 `backend` 文件夹打包成 `backend.zip`
2. 在宝塔文件管理器上传到 `/www/wwwroot/`
3. 解压并重命名为 `ai-photo-backend`

### 步骤3: 创建生产环境配置

```bash
cd /www/wwwroot/ai-photo-backend
cp .env.example .env.production
nano .env.production  # 或用宝塔文件编辑器
```

**编辑 .env.production 配置**:

```bash
# ====== 基础配置 ======
NODE_ENV=production
PORT=3000
API_DOMAIN=https://api.aizhao.icu

# ====== 数据库配置 ======
DB_HOST=localhost
DB_PORT=3306
DB_USER=ai_photo_user
DB_PASSWORD=<你的MySQL密码>
DB_NAME=ai_photo
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# ====== Redis配置 ======
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<你的Redis密码,如果有的话>
REDIS_DB=0

# ====== JWT配置(务必修改) ======
JWT_SECRET=<生成一个32位随机字符串>
JWT_EXPIRE=7d

# ====== 腾讯云COS配置 ======
TENCENT_SECRET_ID=<你的腾讯云SecretId>
TENCENT_SECRET_KEY=<你的腾讯云SecretKey>
TENCENT_APPID=<你的APPID>
COS_BUCKET=ai-photo-prod
COS_REGION=ap-guangzhou
COS_IMAGE_DOMAIN=https://<你的COS域名>

# ====== RunningHub API ======
RUNNINGHUB_API_KEY=<你的RunningHub API Key>
RUNNINGHUB_WEBAPP_ID=<你的WebApp ID>
RUNNINGHUB_BASE_URL=https://api.runninghub.com
RUNNINGHUB_TIMEOUT=600000

# ====== 腾讯混元视频 ======
HUNYUAN_API_KEY=<混元API Key>
HUNYUAN_API_SECRET=<混元API Secret>
HUNYUAN_API_URL=https://hunyuan.tencentcloudapi.com

# ====== 快手视频 ======
KUAI_API_KEY=<快手API Key>

# ====== 短信配置 ======
SMS_PROVIDER=tencent
SMS_APP_ID=<腾讯云短信AppId>
SMS_APP_KEY=<腾讯云短信AppKey>
SMS_TEMPLATE_ID=<短信模板ID>
SMS_SIGN_NAME=AI照

# ====== 加密密钥(务必修改) ======
CREDENTIALS_ENCRYPTION_KEY=<生成一个32位随机字符串>
INTERNAL_CALLBACK_SECRET=<生成一个随机字符串>

# ====== 业务配置 ======
PLAN_MONTHLY_QUOTA=100
MEMBERSHIP_PRICE=9900
MEMBERSHIP_DURATION_DAYS=30
QUOTA_COST_BASIC_CLEAN=1
QUOTA_COST_MODEL_POSE12=1
QUOTA_COST_VIDEO_GENERATE=5

# ====== 内容审核 ======
AUDIT_ENABLED=true
AUDIT_THRESHOLD=0.8

# ====== 日志配置 ======
LOG_LEVEL=info
```

**生成随机密钥的命令**:
```bash
# 生成JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 生成CREDENTIALS_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 步骤4: 创建MySQL数据库

在宝塔面板 → 数据库:

1. 点击 **添加数据库**
   ```
   数据库名: ai_photo
   用户名: ai_photo_user
   密码: <设置一个强密码>
   ```

2. 创建完成后，记录下密码，填入 `.env.production` 的 `DB_PASSWORD`

### 步骤5: 安装依赖

```bash
cd /www/wwwroot/ai-photo-backend
npm install --production
```

### 步骤6: 运行数据库迁移

```bash
# 使用生产环境配置
NODE_ENV=production npx knex migrate:latest

# 查看迁移状态
NODE_ENV=production npx knex migrate:list
```

**应该看到**:
```
Batch 1 - ran the following migrations:
  20231115000001_create_users_table.js
  20231115000002_create_tasks_table.js
  ...
```

### 步骤7: 使用PM2启动应用

```bash
cd /www/wwwroot/ai-photo-backend

# 使用生产环境配置启动
NODE_ENV=production pm2 start ecosystem.config.js

# 保存PM2配置,开机自启
pm2 save
pm2 startup

# 查看运行状态
pm2 status
pm2 logs ai-photo-api
```

### 步骤8: 配置Nginx反向代理

在宝塔面板 → 网站 → 你的站点 → 设置 → 配置文件

添加以下配置:

```nginx
upstream backend_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name api.aizhao.icu;  # 改成你的域名

    # SSL证书配置(如果有)
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    # 日志
    access_log /www/wwwlogs/ai-photo-api-access.log;
    error_log /www/wwwlogs/ai-photo-api-error.log;

    # 上传文件大小限制
    client_max_body_size 50M;

    location / {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时配置
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

保存后重载Nginx:
```bash
nginx -t  # 测试配置
nginx -s reload  # 重载配置
```

### 步骤9: 配置SSL证书(推荐)

在宝塔面板:
1. 网站 → 你的站点 → SSL
2. 选择 **Let's Encrypt** 免费证书
3. 点击申请
4. 开启 **强制HTTPS**

### 步骤10: 测试部署

```bash
# 测试健康检查
curl http://localhost:3000/health
# 应该返回: {"status":"ok",...}

# 测试外网访问
curl https://api.aizhao.icu/health
```

---

## 🔧 常用维护命令

### PM2管理
```bash
pm2 status              # 查看状态
pm2 logs ai-photo-api   # 查看日志
pm2 restart ai-photo-api  # 重启
pm2 stop ai-photo-api   # 停止
pm2 delete ai-photo-api # 删除
```

### 更新代码
```bash
cd /www/wwwroot/ai-photo-backend
git pull
npm install --production
NODE_ENV=production npx knex migrate:latest
pm2 restart ai-photo-api
```

### 查看日志
```bash
# PM2日志
pm2 logs ai-photo-api --lines 100

# 应用日志
tail -f /www/wwwroot/ai-photo-backend/logs/combined.log
tail -f /www/wwwroot/ai-photo-backend/logs/error.log

# Nginx日志
tail -f /www/wwwlogs/ai-photo-api-access.log
tail -f /www/wwwlogs/ai-photo-api-error.log
```

### 数据库备份
```bash
# 在宝塔面板 → 数据库 → 备份
# 或使用命令行
mysqldump -u ai_photo_user -p ai_photo > backup_$(date +%Y%m%d).sql
```

---

## 🔒 安全检查清单

- [ ] 修改了所有默认密码
- [ ] 生成了随机的JWT_SECRET
- [ ] 生成了随机的CREDENTIALS_ENCRYPTION_KEY
- [ ] 配置了SSL证书(HTTPS)
- [ ] 设置了MySQL用户权限(不使用root)
- [ ] 配置了Redis密码
- [ ] 开启了宝塔面板安全入口
- [ ] 配置了防火墙规则
- [ ] 关闭了不必要的端口(只开放80,443,22,宝塔端口)

---

## 🐛 常见问题

### 1. PM2启动失败
```bash
# 检查日志
pm2 logs ai-photo-api --err

# 常见原因:
# - 端口3000被占用
# - .env.production配置错误
# - 数据库连接失败
```

### 2. 数据库连接失败
```bash
# 检查MySQL是否运行
systemctl status mysqld

# 检查用户权限
mysql -u ai_photo_user -p
```

### 3. Redis连接失败
```bash
# 检查Redis是否运行
systemctl status redis

# 测试连接
redis-cli ping
```

### 4. Nginx 502错误
```bash
# 检查后端是否运行
pm2 status
curl http://localhost:3000/health

# 检查Nginx配置
nginx -t

# 查看Nginx错误日志
tail -f /www/wwwlogs/ai-photo-api-error.log
```

---

## 📊 性能优化建议

### 1. PM2集群模式
编辑 `ecosystem.config.js`:
```javascript
instances: 'max',  // 使用所有CPU核心
exec_mode: 'cluster'
```

### 2. Nginx缓存
在Nginx配置中添加:
```nginx
# 静态资源缓存
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 3. 数据库连接池
在 `.env.production` 中调整:
```bash
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=30
```

---

## 📞 遇到问题?

1. 查看日志: `pm2 logs ai-photo-api`
2. 检查配置: `cat .env.production`
3. 测试连接: `curl http://localhost:3000/health`
4. 联系老王 😄

---

**部署成功标志**:
```bash
✅ pm2 status 显示 online
✅ curl localhost:3000/health 返回 200
✅ 外网可以访问 https://api.aizhao.icu/health
✅ 日志没有error
```

祝部署顺利！💪
