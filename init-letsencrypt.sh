#!/bin/bash
# ================================
# Let's Encrypt SSL证书自动化脚本
# ================================
# 艹！一键申请证书，自动续期，再也不用管！
#
# 使用方法：
# 1. 确保域名已经解析到服务器IP
# 2. 修改下面的配置（域名和邮箱）
# 3. chmod +x init-letsencrypt.sh
# 4. sudo ./init-letsencrypt.sh

set -e

# ========== 配置区域（修改这里）==========
DOMAINS=(aizhao.icu www.aizhao.icu api.aizhao.icu)
EMAIL="admin@aizhao.icu"  # 艹！改成你的邮箱
STAGING=0  # 0=正式证书，1=测试证书（调试用）

# ========================================

DATA_PATH="./nginx/ssl"
RSA_KEY_SIZE=4096

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "=========================================="
echo "艹！Let's Encrypt SSL证书自动化配置"
echo "=========================================="
echo -e "${NC}"

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}艹！Docker未安装，请先安装Docker${NC}"
    exit 1
fi

# 检查docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}艹！docker-compose未安装${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}配置信息：${NC}"
echo "域名: ${DOMAINS[*]}"
echo "邮箱: $EMAIL"
echo "证书类型: $([ $STAGING -eq 1 ] && echo '测试证书' || echo '正式证书')"
echo ""

read -p "确认以上信息正确？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}已取消${NC}"
    exit 1
fi

# 创建必要目录
echo ""
echo -e "${GREEN}1. 创建目录...${NC}"
mkdir -p "$DATA_PATH/conf/live/${DOMAINS[0]}"
mkdir -p "$DATA_PATH/www"

# 下载推荐的TLS参数
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ]; then
    echo ""
    echo -e "${GREEN}2. 下载SSL配置...${NC}"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
fi

if [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
    echo ""
    echo -e "${GREEN}3. 生成DH参数（需要几分钟）...${NC}"
    openssl dhparam -out "$DATA_PATH/conf/ssl-dhparams.pem" 2048
fi

# 创建临时自签名证书（用于Nginx首次启动）
echo ""
echo -e "${GREEN}4. 创建临时证书...${NC}"
CERT_PATH="/etc/letsencrypt/live/${DOMAINS[0]}"
docker run --rm -v "$DATA_PATH/conf:$CERT_PATH" certbot/certbot \
    sh -c "mkdir -p $CERT_PATH && \
    openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '$CERT_PATH/privkey.pem' \
    -out '$CERT_PATH/fullchain.pem' \
    -subj '/CN=localhost'"

# 启动Nginx
echo ""
echo -e "${GREEN}5. 启动Nginx...${NC}"
docker-compose -f docker-compose.prod.yml up -d nginx

# 删除临时证书
echo ""
echo -e "${GREEN}6. 删除临时证书...${NC}"
docker run --rm -v "$DATA_PATH/conf:/etc/letsencrypt" certbot/certbot \
    delete --cert-name ${DOMAINS[0]} -n || true

# 申请真实证书
echo ""
echo -e "${GREEN}7. 申请Let's Encrypt证书...${NC}"

# 构建域名参数
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# 选择证书服务器
if [ $STAGING -eq 1 ]; then
    STAGING_ARG="--staging"
    echo -e "${YELLOW}使用测试服务器（不计入申请次数限制）${NC}"
else
    STAGING_ARG=""
    echo -e "${YELLOW}使用正式服务器${NC}"
fi

# 申请证书
docker run --rm -v "$DATA_PATH/conf:/etc/letsencrypt" \
    -v "$DATA_PATH/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    $STAGING_ARG \
    $DOMAIN_ARGS

# 重启Nginx
echo ""
echo -e "${GREEN}8. 重启Nginx...${NC}"
docker-compose -f docker-compose.prod.yml restart nginx

echo ""
echo -e "${GREEN}=========================================="
echo "艹！SSL证书配置完成！"
echo "=========================================="
echo ""
echo "证书位置: $DATA_PATH/conf/live/${DOMAINS[0]}/"
echo ""
echo "证书有效期: 90天"
echo "自动续期: Certbot容器会每12小时检查并自动续期"
echo ""
echo "验证证书："
echo "  https://${DOMAINS[0]}"
echo ""
echo "查看证书信息："
echo "  docker run --rm -v \"$DATA_PATH/conf:/etc/letsencrypt\" certbot/certbot certificates"
echo ""
echo -e "${NC}"
