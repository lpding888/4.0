#!/bin/bash
# 老王我给你写的宝塔面板部署脚本，一键部署！

echo "🚀 开始部署AI服装处理平台前端..."

# 设置变量
PROJECT_DIR="/www/wwwroot/ai-photo-frontend"
NODE_VERSION="18"

echo "📦 安装依赖..."
cd $PROJECT_DIR

# 使用国内镜像源
npm config set registry https://registry.npmmirror.com/

# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install --production

echo "🔧 配置环境变量..."
# 复制生产环境配置
if [ -f ".env.production" ]; then
    cp .env.production .env.local
    echo "✅ 环境变量配置完成"
else
    echo "❌ 找不到.env.production文件，请先配置"
    exit 1
fi

echo "🏗️ 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查代码"
    exit 1
fi

echo "🔄 重启服务..."
# 停止现有进程
pm2 stop ai-photo-frontend 2>/dev/null || true

# 启动新进程
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

echo "✅ 部署完成！"
echo "📊 服务状态："
pm2 status
echo ""
echo "🌐 访问地址: https://your-domain.com"
echo "📝 查看日志: pm2 logs ai-photo-frontend"