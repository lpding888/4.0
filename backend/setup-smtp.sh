#!/bin/bash

# SMTP配置脚本
# 用法: ./setup-smtp.sh

ENV_FILE="backend/.env"

echo "📧 配置SMTP邮件服务..."

# 检查.env文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env 文件不存在，从 .env.example 复制..."
    cp backend/.env.example "$ENV_FILE"
fi

# 添加或更新SMTP配置
echo ""
echo "请按照提示输入SMTP配置信息："
echo ""
echo "提供的腾讯云邮件配置："
echo "  SMTP服务器: gz-smtp.qcloudmail.com"
echo "  端口: 465"
echo "  用户名: noreply@aizhao.icu"
echo "  密码: OZ1i9sSS2Xr11UL4bCe8f"
echo ""

# 检查是否已有SMTP配置
if grep -q "SMTP_HOST" "$ENV_FILE"; then
    echo "⚠️  检测到已有SMTP配置，是否覆盖? (y/n)"
    read -r answer
    if [ "$answer" != "y" ]; then
        echo "❌ 取消配置"
        exit 0
    fi

    # 删除旧配置
    sed -i '/SMTP_HOST/d' "$ENV_FILE"
    sed -i '/SMTP_PORT/d' "$ENV_FILE"
    sed -i '/SMTP_SECURE/d' "$ENV_FILE"
    sed -i '/SMTP_USER/d' "$ENV_FILE"
    sed -i '/SMTP_PASSWORD/d' "$ENV_FILE"
    sed -i '/SMTP_FROM/d' "$ENV_FILE"
    sed -i '/SMTP_FROM_NAME/d' "$ENV_FILE"
fi

# 添加SMTP配置
cat >> "$ENV_FILE" << 'EOF'

# SMTP邮件配置（用于发送验证码邮件）
SMTP_HOST=gz-smtp.qcloudmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@aizhao.icu
SMTP_PASSWORD=OZ1i9sSS2Xr11UL4bCe8f
SMTP_FROM=noreply@aizhao.icu
SMTP_FROM_NAME=AI衣柜
EOF

echo ""
echo "✅ SMTP配置已添加到 $ENV_FILE"
echo ""
echo "⚠️  重要提示："
echo "1. .env 文件包含敏感信息，已被 .gitignore 忽略"
echo "2. 不要将 .env 文件提交到Git仓库"
echo "3. 生产环境请使用环境变量或密钥管理服务"
echo ""
