# 宝塔面板部署指南
## 老王我给你写的宝塔部署教程，别TM瞎搞！

### 🚀 部署步骤

#### 1. 宝塔面板环境配置
```bash
# 安装Node.js版本管理器
# 宝塔面板 -> 软件商店 -> 搜索 "Node.js" -> 安装 Node.js 版本管理器
# 建议安装 Node.js 18.x 版本
```

#### 2. 上传项目文件
```bash
# 方式1: 宝塔面板文件管理器
# 将整个前端项目文件夹上传到 /www/wwwroot/your-domain/

# 方式2: Git克隆（推荐）
cd /www/wwwroot/your-domain/
git clone your-repo-url .
```

#### 3. 安装依赖
```bash
cd /www/wwwroot/your-domain/

# 使用国内镜像源（服务器推荐）
npm config set registry https://registry.npmmirror.com/

# 安装依赖
npm install --production
```

#### 4. 环境变量配置
```bash
# 复制生产环境配置文件
cp .env.production .env.local

# 修改API地址为你的实际后端地址
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

#### 5. 构建项目
```bash
# 生产构建
npm run build
```

#### 6. 宝塔面板网站配置
```nginx
# 网站设置 -> 配置文件 -> 添加以下配置

location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# 静态文件缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### 7. PM2进程管理
```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ai-photo-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/www/wwwroot/your-domain',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/www/wwwlogs/ai-photo-frontend-error.log',
    out_file: '/www/wwwlogs/ai-photo-frontend-out.log',
    log_file: '/www/wwwlogs/ai-photo-frontend.log',
    time: true
  }]
}
EOF

# 启动项目
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

#### 8. SSL证书配置（可选）
```bash
# 宝塔面板 -> 网站 -> SSL -> Let's Encrypt
# 免费申请SSL证书，开启HTTPS
```

### 🔧 常用命令

```bash
# 查看项目状态
pm2 status

# 查看日志
pm2 logs ai-photo-frontend

# 重启项目
pm2 restart ai-photo-frontend

# 停止项目
pm2 stop ai-photo-frontend

# 重新部署
git pull
npm install
npm run build
pm2 restart ai-photo-frontend
```

### ⚠️ 注意事项

1. **端口问题** - 确保服务器3000端口没有被占用
2. **防火墙** - 宝塔面板安全组要开放3000端口
3. **内存监控** - PM2会自动重启，但要监控服务器内存使用
4. **日志清理** - 定期清理PM2日志文件
5. **备份** - 定期备份项目文件和数据库

### 🐛 常见问题

**Q: 构建失败怎么办？**
A: 检查Node.js版本，确保18.x以上，删除node_modules重新安装

**Q: 页面404？**
A: 检查nginx反向代理配置，确保proxy_pass指向正确的端口

**Q: API请求失败？**
A: 检查.env.local中的NEXT_PUBLIC_API_URL配置

**Q: 内存不足？**
A: 在PM2配置中设置max_memory_restart限制

---
**老王提示**: 宝塔面板比Docker简单多了，直接Node.js部署就行！