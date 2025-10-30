#!/bin/bash

################################################################################
# SCF云函数一键部署脚本
# 用途：自动部署所有云函数到腾讯云
# 使用：bash deploy.sh [--stage prod|test]
################################################################################

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认部署环境
STAGE="${1:-prod}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   SCF Worker 云函数部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查必要的环境变量
echo -e "${YELLOW}[1/7] 检查环境变量...${NC}"

required_vars=(
  "TENCENT_SECRET_ID"
  "TENCENT_SECRET_KEY"
  "COS_BUCKET"
  "COS_REGION"
  "INTERNAL_CALLBACK_SECRET"
  "BACKEND_API_URL"
)

missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo -e "${RED}❌ 缺少必要的环境变量：${NC}"
  for var in "${missing_vars[@]}"; do
    echo -e "${RED}   - $var${NC}"
  done
  echo ""
  echo -e "${YELLOW}请设置环境变量后再运行部署脚本${NC}"
  echo ""
  echo "示例："
  echo "  export TENCENT_SECRET_ID=\"AKIDxxxxxxxx\""
  echo "  export TENCENT_SECRET_KEY=\"xxxxxxxx\""
  echo "  export COS_BUCKET=\"your-bucket\""
  echo "  export COS_REGION=\"ap-guangzhou\""
  echo "  export INTERNAL_CALLBACK_SECRET=\"your-secret\""
  echo "  export BACKEND_API_URL=\"https://your-backend.com\""
  exit 1
fi

echo -e "${GREEN}✅ 环境变量检查通过${NC}"
echo ""

# 检查 Serverless Framework
echo -e "${YELLOW}[2/7] 检查 Serverless Framework...${NC}"

if ! command -v serverless &> /dev/null; then
  echo -e "${RED}❌ 未安装 Serverless Framework${NC}"
  echo ""
  echo "请先安装："
  echo "  npm install -g serverless"
  exit 1
fi

echo -e "${GREEN}✅ Serverless Framework 已安装${NC}"
echo ""

# 获取当前目录
SCF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo -e "${YELLOW}[3/7] 当前目录: $SCF_DIR${NC}"
echo ""

# 部署函数列表
FUNCTIONS=(
  "video-compositor"
  "image-compositor"
  "text-processor"
)

# 部署每个函数
for func in "${FUNCTIONS[@]}"; do
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}[部署] $func${NC}"
  echo -e "${YELLOW}========================================${NC}"

  func_dir="$SCF_DIR/$func"

  if [ ! -d "$func_dir" ]; then
    echo -e "${RED}❌ 目录不存在: $func_dir${NC}"
    continue
  fi

  cd "$func_dir"

  # 安装依赖
  echo -e "${YELLOW}[4/7] 安装依赖...${NC}"
  if [ -f "package.json" ]; then
    npm install --production
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
  fi
  echo ""

  # 部署到腾讯云
  echo -e "${YELLOW}[5/7] 部署到腾讯云 (stage=$STAGE)...${NC}"
  serverless deploy --stage "$STAGE" --verbose

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $func 部署成功${NC}"
  else
    echo -e "${RED}❌ $func 部署失败${NC}"
    exit 1
  fi

  echo ""
done

# 返回原目录
cd "$SCF_DIR"

# 部署完成总结
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}[6/7] 已部署的云函数：${NC}"
for func in "${FUNCTIONS[@]}"; do
  echo -e "${GREEN}  ✅ $func${NC}"
done
echo ""

# 后续步骤提示
echo -e "${YELLOW}[7/7] 后续步骤：${NC}"
echo ""
echo "1. 登录腾讯云控制台，查看云函数列表"
echo "2. 配置 API 网关触发器（如果使用 HTTP 触发）"
echo "3. 配置 COS 触发器（如果使用 COS 事件触发）"
echo "4. 测试云函数调用"
echo "5. 更新后端 provider_endpoints 表（记录云函数URL）"
echo ""

# 记录部署后的 URL（需要从 serverless 输出中提取）
echo -e "${YELLOW}⚠️  请记录以下环境变量供后端使用：${NC}"
echo ""
echo "export SCF_VIDEO_COMPOSITOR_URL=\"<从腾讯云控制台获取>\""
echo "export SCF_IMAGE_COMPOSITOR_URL=\"<从腾讯云控制台获取>\""
echo "export SCF_TEXT_PROCESSOR_URL=\"<从腾讯云控制台获取>\""
echo ""

echo -e "${GREEN}🎉 所有云函数部署完成！${NC}"
