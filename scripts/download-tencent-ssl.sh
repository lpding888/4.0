#!/bin/bash
# ================================
# 腾讯云SSL证书下载和配置脚本
# ================================
# 艹！使用你已经申请好的腾讯云证书

set -e

echo "=========================================="
echo "艹！开始下载腾讯云SSL证书"
echo "=========================================="

# 创建SSL目录
mkdir -p nginx/ssl/aizhao.icu

echo ""
echo "请按以下步骤操作："
echo ""
echo "1. 打开腾讯云SSL证书管理页面"
echo "   https://console.cloud.tencent.com/ssl"
echo ""
echo "2. 下载 admin.aizhao.icu 的证书"
echo "   - 点击【下载】按钮"
echo "   - 选择【Nginx】格式"
echo "   - 解压后得到："
echo "     * admin.aizhao.icu_bundle.crt  (证书文件)"
echo "     * admin.aizhao.icu.key         (私钥文件)"
echo ""
echo "3. 下载 api.aizhao.icu 的证书"
echo "   - 同样步骤下载Nginx格式"
echo ""
echo "4. 将下载的文件重命名并放到项目目录："
echo ""
echo "   nginx/ssl/aizhao.icu/"
echo "   ├── fullchain.pem  (重命名自 admin.aizhao.icu_bundle.crt)"
echo "   └── privkey.pem    (重命名自 admin.aizhao.icu.key)"
echo ""
echo "5. 执行以下命令设置权限："
echo ""
echo "   chmod 600 nginx/ssl/aizhao.icu/privkey.pem"
echo "   chmod 644 nginx/ssl/aizhao.icu/fullchain.pem"
echo ""
echo "=========================================="
echo "艹！证书配置完成后，运行："
echo "docker-compose -f docker-compose.prod.yml up -d"
echo "=========================================="
