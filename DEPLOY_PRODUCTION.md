# ⚠️ 生产环境部署清单

## 🚨 关键配置修改

部署到服务器前，**必须修改以下配置**，否则系统无法正常工作！

---

## 1. 数据库配置 (backend/.env)

```bash
# ⚠️ 修改为生产数据库连接信息
DB_HOST=your_production_mysql_host
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_strong_password_here
DB_NAME=ai_photo
```

---

## 2. 腾讯云COS配置 (backend/.env)

```bash
# ⚠️⚠️⚠️ 本地开发使用的是MinIO模拟，生产必须改为真实腾讯云COS配置
# 本地配置（删除）：
# TENCENT_SECRET_ID=minioadmin
# TENCENT_SECRET_KEY=minioadmin123
# COS_BUCKET=ai-photo-dev
# COS_REGION=local
# COS_IMAGE_DOMAIN=http://localhost:9000

# 生产配置（使用）：
TENCENT_SECRET_ID=your_real_tencent_secret_id
TENCENT_SECRET_KEY=your_real_tencent_secret_key
TENCENT_APPID=your_real_app_id
COS_BUCKET=your-production-bucket-name
COS_REGION=ap-guangzhou
COS_IMAGE_DOMAIN=https://your-bucket.cos.ap-guangzhou.myqcloud.com
```

---

## 3. Redis配置 (backend/.env)

```bash
# ⚠️ 修改为生产Redis连接信息
REDIS_HOST=your_production_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

---

## 4. JWT密钥 (backend/.env)

```bash
# ⚠️ 生成强随机密钥（至少32字符）
JWT_SECRET=生成一个随机的32位以上密钥_不要用测试密钥
```

**生成方法**：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. 加密密钥 (backend/.env)

```bash
# ⚠️ 用于加密provider credentials
CREDENTIALS_ENCRYPTION_KEY=生成一个随机的32位密钥

# ⚠️ 用于SCF回调签名验证
INTERNAL_CALLBACK_SECRET=生成一个随机的强密钥
```

---

## 6. RunningHub配置 (backend/.env)

```bash
# ⚠️ 修改为真实的RunningHub API配置
RUNNINGHUB_API_KEY=your_real_runninghub_api_key
RUNNINGHUB_WEBAPP_ID=your_real_webapp_id
RUNNINGHUB_BASE_URL=https://api.runninghub.com
```

---

## 7. 短信服务配置 (backend/.env)

```bash
# ⚠️ 添加腾讯云短信配置
SMS_PROVIDER=tencent
SMS_APP_ID=your_sms_app_id
SMS_APP_KEY=your_sms_app_key
SMS_TEMPLATE_ID=your_template_id
SMS_SIGN_NAME=你的签名
```

---

## 8. 微信支付配置 (backend/.env)

```bash
# ⚠️ 添加微信支付配置
PAYMENT_CHANNEL=wx
WECHAT_APPID=your_wechat_app_id
WECHAT_MCHID=your_merchant_id
WECHAT_API_KEY=your_wechat_api_key
WECHAT_CERT_PATH=/path/to/production/cert.pem
```

---

## 9. 内容审核配置 (backend/.env)

```bash
# ⚠️ 生产环境建议开启内容审核
AUDIT_ENABLED=true
AUDIT_THRESHOLD=0.8
```

---

## 10. 服务器配置 (backend/.env)

```bash
# ⚠️ 修改为生产环境设置
PORT=3000
NODE_ENV=production
API_DOMAIN=https://your-production-domain.com
LOG_LEVEL=info
```

---

## 📋 部署步骤

### 1. 上传代码到服务器

```bash
# 排除node_modules和.env文件
rsync -av --exclude='node_modules' --exclude='.env' \
  ./ user@your-server:/path/to/project/
```

### 2. 服务器上安装依赖

```bash
cd /path/to/project/backend
npm install --production
```

### 3. 配置环境变量

```bash
# 复制模板
cp .env.example .env

# 编辑.env，按照上面的清单修改所有配置
vim .env
```

### 4. 执行数据库迁移

```bash
npm run db:migrate
```

### 5. 启动服务（使用PM2）

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## ⚠️ 安全检查清单

在部署前，确认以下事项：

- [ ] 所有密钥都已替换为生产环境密钥
- [ ] JWT_SECRET是强随机密钥（不是测试密钥）
- [ ] 数据库密码足够强
- [ ] Redis设置了密码
- [ ] COS配置是真实的腾讯云配置（不是MinIO）
- [ ] 防火墙只开放必要端口
- [ ] 内容审核已开启
- [ ] 日志级别设置为info或warn
- [ ] NODE_ENV设置为production
- [ ] API_DOMAIN设置为生产域名

---

## 🔍 验证部署成功

```bash
# 1. 检查服务是否运行
curl http://localhost:3000/health

# 2. 检查数据库连接
pm2 logs ai-photo-backend --lines 50

# 3. 检查Redis连接
redis-cli -h your_redis_host -a your_redis_password ping

# 4. 检查COS配置
# 尝试上传一个测试文件
```

---

## 📞 问题排查

### 服务启动失败

```bash
# 查看PM2日志
pm2 logs ai-photo-backend

# 查看错误日志
tail -f backend/logs/error.log
```

### 数据库连接失败

```bash
# 测试MySQL连接
mysql -h your_host -u your_user -p ai_photo

# 检查防火墙
telnet your_mysql_host 3306
```

### COS上传失败

```bash
# 检查COS配置是否正确
# 在腾讯云控制台验证：
# 1. SecretId/SecretKey是否正确
# 2. Bucket是否存在
# 3. 权限是否配置正确
```

---

**重要提醒**：生产环境配置错误可能导致：
- 🔥 数据泄露
- 🔥 服务无法启动
- 🔥 用户无法上传文件
- 🔥 支付功能异常

**请仔细核对每一项配置！**
