#!/bin/bash

#########################
# 数据库重置和初始化脚本
# 用于本地开发环境快速重建数据库
#########################

set -e

echo "🔥 老王的数据库重置脚本 - 开始执行"
echo "=========================================="

# 切换到项目根目录
cd "$(dirname "$0")/.."

echo ""
echo "步骤 1/5: 停止并删除现有容器..."
docker-compose -f docker-compose.dev.yml down -v

echo ""
echo "步骤 2/5: 启动数据库容器..."
docker-compose -f docker-compose.dev.yml up -d mysql redis

echo ""
echo "步骤 3/5: 等待MySQL启动（最多60秒）..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker exec ai-photo-mysql-dev mysqladmin ping -h localhost -uroot -pdev_password_123 --silent 2>/dev/null; then
        echo "✅ MySQL已就绪！"
        break
    fi
    echo -n "."
    sleep 2
    elapsed=$((elapsed + 2))
done

if [ $elapsed -ge $timeout ]; then
    echo ""
    echo "❌ MySQL启动超时！"
    exit 1
fi

echo ""
echo "步骤 4/5: 执行数据库迁移..."
npm run db:migrate

echo ""
echo "步骤 5/5: 查看迁移状态..."
npx knex migrate:status

echo ""
echo "=========================================="
echo "✅ 数据库初始化完成！"
echo ""
echo "📊 容器状态："
docker-compose -f docker-compose.dev.yml ps
echo ""
echo "🚀 可以启动后端服务了："
echo "   npm run dev"
echo ""
