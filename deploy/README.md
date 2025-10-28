# 🚀 部署 / 运维脚本

> **状态**：开发中（TODO）

## 📋 目录职责

本目录用于存放部署和运维相关脚本，包括：

- **部署脚本**：自动化部署流程
- **环境配置**：环境变量模板和配置
- **上线步骤**：发布流程和检查清单
- **监控配置**：系统监控和告警设置

## 🎯 预期内容

### 📦 部署脚本
```bash
├── scripts/
│   ├── deploy.sh              # 主部署脚本
│   ├── rollback.sh            # 回滚脚本
│   ├── backup.sh              # 数据备份脚本
│   ├── health-check.sh        # 健康检查脚本
│   └── cleanup.sh             # 资源清理脚本
```

### ⚙️ 环境配置
```bash
├── configs/
│   ├── .env.example           # 环境变量模板
│   ├── nginx.conf             # Nginx配置
│   ├── pm2.config.js          # PM2进程管理配置
│   └── docker-compose.yml     # Docker编排配置
```

### 📋 上线步骤
```bash
├── procedures/
│   ├── PRE_DEPLOY_CHECKLIST.md # 部署前检查清单
│   ├── DEPLOY_STEPS.md         # 部署步骤文档
│   └── POST_DEPLOY_CHECKLIST.md # 部署后检查清单
```

### 📊 监控配置
```bash
├── monitoring/
│   ├── prometheus.yml          # Prometheus配置
│   ├── grafana-dashboards/     # Grafana仪表板
│   └── alert-rules.yml         # 告警规则配置
```

## ⚠️ 运维注意事项

### 🔐 安全规范
- ❌ **严禁**将生产密钥提交到仓库
- ❌ **严禁**在生产环境使用默认密码
- ✅ 使用密钥管理服务
- ✅ 定期轮换访问密钥

### 🚀 部署流程
1. **预部署检查**
   - 代码审查通过
   - 测试环境验证
   - 数据库备份完成
   - 配置文件准备就绪

2. **执行部署**
   - 拉取最新代码
   - 安装依赖包
   - 构建前端资源
   - 重启后端服务

3. **部署后验证**
   - 服务健康检查
   - 功能回归测试
   - 性能指标验证
   - 监控告警确认

### 📊 监控指标
- **系统指标**：CPU、内存、磁盘、网络
- **应用指标**：响应时间、错误率、吞吐量
- **业务指标**：任务成功率、用户活跃度
- **安全指标**：异常访问、API调用频率

## 🔧 环境变量模板

### 后端环境变量 (.env.example)
```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=ai_photo

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 腾讯云配置
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
COS_BUCKET=your_cos_bucket
COS_REGION=ap-guangzhou

# 微信支付配置
WECHAT_APP_ID=your_wechat_app_id
WECHAT_MCH_ID=your_wechat_mch_id
WECHAT_API_KEY=your_wechat_api_key

# RunningHub配置
RUNNINGHUB_API_KEY=your_runninghub_api_key
RUNNINGHUB_BASE_URL=https://api.runninghub.com

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### 前端环境变量 (.env.example)
```bash
# API配置
NEXT_PUBLIC_API_BASE_URL=https://api.aizhao.icu
NEXT_PUBLIC_WS_URL=wss://api.aizhao.icu

# 微信配置
NEXT_PUBLIC_WECHAT_APP_ID=your_wechat_app_id

# 腾讯云COS配置
NEXT_PUBLIC_COS_BUCKET=your_cos_bucket
NEXT_PUBLIC_COS_REGION=ap-guangzhou
```

## 🚀 快速部署

### 开发环境部署
```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入实际配置

# 2. 启动后端服务
cd ../backend
npm install
npm run dev

# 3. 启动前端服务
cd ../frontend
npm install
npm run dev
```

### 生产环境部署
```bash
# 1. 拉取最新代码
git pull origin main

# 2. 构建前端资源
cd ../frontend
npm run build

# 3. 重启后端服务
cd ../backend
pm2 reload ecosystem.config.js

# 4. 健康检查
./scripts/health-check.sh
```

## 📞 应急响应

### 🚨 常见问题处理
- **服务无法启动**：检查端口占用、配置文件
- **数据库连接失败**：检查网络、认证信息
- **API响应慢**：检查日志、性能指标
- **磁盘空间不足**：清理日志、临时文件

### 🔄 回滚流程
```bash
# 1. 停止当前服务
pm2 stop all

# 2. 切换到上一个版本
git checkout HEAD~1

# 3. 重新部署
./scripts/deploy.sh

# 4. 验证服务状态
./scripts/health-check.sh
```

---

**重要提醒**：生产环境部署前必须完整测试，确保备份和回滚方案就绪！