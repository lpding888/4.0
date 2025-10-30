#!/bin/bash
# AI照片后端 - 宝塔快速部署脚本
# 老王编写，保证能用！

set -e  # 遇到错误立即退出

echo "================================"
echo "  AI照片后端 - 快速部署脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在backend目录下运行此脚本${NC}"
    exit 1
fi

# 1. 检查Node.js版本
echo -e "${YELLOW}[1/8] 检查Node.js版本...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}错误: 需要Node.js 16或更高版本${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js版本: $(node -v)${NC}"

# 2. 检查.env.production是否存在
echo -e "${YELLOW}[2/8] 检查环境配置...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}错误: .env.production 文件不存在${NC}"
    echo "请先复制 .env.example 并修改配置:"
    echo "  cp .env.example .env.production"
    echo "  nano .env.production"
    exit 1
fi
echo -e "${GREEN}✓ 环境配置文件存在${NC}"

# 3. 安装依赖
echo -e "${YELLOW}[3/8] 安装依赖包...${NC}"
npm install --production
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 4. 测试数据库连接
echo -e "${YELLOW}[4/8] 测试数据库连接...${NC}"
NODE_ENV=production node -e "
const db = require('./src/config/database');
db.raw('SELECT 1')
  .then(() => {
    console.log('✓ 数据库连接成功');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ 数据库连接失败:', err.message);
    process.exit(1);
  });
" || {
    echo -e "${RED}数据库连接失败，请检查.env.production中的数据库配置${NC}"
    exit 1
}

# 5. 运行数据库迁移
echo -e "${YELLOW}[5/8] 运行数据库迁移...${NC}"
NODE_ENV=production npx knex migrate:latest
echo -e "${GREEN}✓ 数据库迁移完成${NC}"

# 6. 创建必要的目录
echo -e "${YELLOW}[6/8] 创建日志目录...${NC}"
mkdir -p logs
echo -e "${GREEN}✓ 目录创建完成${NC}"

# 7. 检查PM2
echo -e "${YELLOW}[7/8] 检查PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2未安装,正在安装...${NC}"
    npm install -g pm2
fi
echo -e "${GREEN}✓ PM2已就绪${NC}"

# 8. 启动应用
echo -e "${YELLOW}[8/8] 启动应用...${NC}"

# 检查是否已经在运行
if pm2 list | grep -q "ai-photo-api"; then
    echo "应用已在运行,正在重启..."
    NODE_ENV=production pm2 restart ecosystem.config.js
else
    echo "首次启动应用..."
    NODE_ENV=production pm2 start ecosystem.config.js
fi

# 保存PM2配置
pm2 save

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  部署完成! ${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs ai-photo-api"
echo "重启应用: pm2 restart ai-photo-api"
echo "停止应用: pm2 stop ai-photo-api"
echo ""

# 显示服务状态
pm2 status

# 测试健康检查
echo ""
echo -e "${YELLOW}正在测试健康检查...${NC}"
sleep 3  # 等待服务启动
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}✓ 健康检查通过! 服务运行正常${NC}"
else
    echo -e "${RED}✗ 健康检查失败,请查看日志: pm2 logs ai-photo-api${NC}"
fi

echo ""
echo -e "${GREEN}完成! 现在可以配置Nginx反向代理了${NC}"
