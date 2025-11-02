#!/bin/bash

# ================================
# AI照后端 - 一键部署脚本
# ================================
# 艹！老王我给你写的自动化部署脚本
#
# 使用方法:
# chmod +x deploy.sh
# ./deploy.sh

set -e  # 艹！遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 艹！打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 艹！检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 艹！Banner
echo "================================"
echo "   AI照后端 - 一键部署脚本"
echo "   老王制作，绝对靠谱！"
echo "================================"
echo ""

# 艹！Step 1: 检查依赖
print_info "步骤1/7: 检查系统依赖..."
check_command docker
check_command docker-compose
print_success "Docker 和 Docker Compose 已安装"

# 艹！Step 2: 检查环境变量文件
print_info "步骤2/7: 检查环境变量配置..."
if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env 文件不存在"
    print_info "正在从 .env.example 创建..."
    cp backend/.env.example backend/.env
    print_warning "⚠️  请编辑 backend/.env 文件，填写真实配置！"
    print_warning "⚠️  特别注意以下配置必须修改："
    print_warning "    - DB_PASSWORD (数据库密码)"
    print_warning "    - JWT_SECRET (JWT密钥)"
    print_warning "    - TENCENT_SECRET_ID/KEY (腾讯云密钥)"
    print_warning "    - REDIS_PASSWORD (Redis密码)"
    echo ""
    read -p "是否现在编辑 .env 文件？(y/n): " edit_env
    if [ "$edit_env" = "y" ] || [ "$edit_env" = "Y" ]; then
        ${EDITOR:-vim} backend/.env
    else
        print_error "请先配置 backend/.env 文件后再运行此脚本！"
        exit 1
    fi
else
    print_success "backend/.env 文件已存在"
fi

# 艹！Step 3: 创建必要的目录
print_info "步骤3/7: 创建必要的目录..."
mkdir -p docker/nginx/logs
mkdir -p docker/nginx/ssl
mkdir -p docker/mysql/logs
mkdir -p backend/logs
print_success "目录创建完成"

# 艹！Step 4: 停止旧服务（如果存在）
print_info "步骤4/7: 停止旧服务..."
if docker-compose ps -q 2>/dev/null | grep -q .; then
    print_warning "检测到运行中的服务，正在停止..."
    docker-compose down
    print_success "旧服务已停止"
else
    print_info "没有运行中的服务"
fi

# 艹！Step 5: 构建镜像
print_info "步骤5/7: 构建Docker镜像..."
docker-compose build backend
print_success "镜像构建完成"

# 艹！Step 6: 启动服务
print_info "步骤6/7: 启动所有服务..."
docker-compose up -d
print_success "服务启动完成"

# 艹！等待服务就绪
print_info "等待服务启动..."
sleep 10

# 艹！检查服务状态
print_info "检查服务状态..."
docker-compose ps

# 艹！Step 7: 运行数据库迁移
print_info "步骤7/7: 运行数据库迁移..."
print_warning "等待MySQL完全启动..."
sleep 20

MAX_RETRIES=5
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose exec -T backend npm run db:migrate 2>/dev/null; then
        print_success "数据库迁移完成"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT+1))
        print_warning "数据库迁移失败，重试 $RETRY_COUNT/$MAX_RETRIES..."
        sleep 10
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "数据库迁移失败，请手动运行: docker-compose exec backend npm run db:migrate"
fi

# 艹！部署完成
echo ""
echo "================================"
print_success "🎉 部署完成！"
echo "================================"
echo ""
print_info "服务访问地址："
echo "  - API健康检查: http://localhost/health"
echo "  - API文档: http://localhost/api-docs"
echo "  - Prometheus指标: http://localhost/metrics"
echo ""
print_info "常用命令："
echo "  - 查看日志: docker-compose logs -f backend"
echo "  - 查看状态: docker-compose ps"
echo "  - 重启服务: docker-compose restart"
echo "  - 停止服务: docker-compose down"
echo ""
print_warning "⚠️  下一步操作："
echo "  1. 配置SSL证书（参考 docker/nginx/ssl/README.md）"
echo "  2. 修改 docker/nginx/conf.d/api.conf 中的域名"
echo "  3. 启用HTTPS配置"
echo "  4. 配置防火墙规则"
echo ""
print_info "艹！有问题随时找老王！"
