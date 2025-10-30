# ⚡ SCF Worker - 腾讯云函数工作体系

> **状态**：✅ 开发完成（已实现所有任务卡功能）

## 📋 目录职责

本目录包含三个云函数和通用模块，负责处理主后端无法承载的重任务：

- **视频合成** (video-compositor) - 多SKU合辑短片处理
- **图片拼接** (image-compositor) - 九宫格/多图合成
- **文本处理** (text-processor) - 文案生成和格式化
- **通用模块** (common) - 日志、错误处理、文件下载

## 🎯 已实现功能

### ✅ 视频合成云函数 (video-compositor)
- ✅ 多视频片段拼接（支持转场效果）
- ✅ 字幕叠加（自定义文本、位置、样式）
- ✅ Logo 水印（9种位置、透明度控制）
- ✅ 自动上传到 COS
- ✅ 安全回调后端（HMAC-SHA256 签名）

### ✅ 图片拼接云函数 (image-compositor)
- ✅ 九宫格布局（2x2, 3x3, 3x4, 4x4）
- ✅ 图片自动缩放保持宽高比
- ✅ 自定义间距和背景色
- ✅ 高性能处理（Sharp库）
- ✅ 输出清晰无失真

### ✅ 文本处理云函数 (text-processor)
- ✅ 模板变量替换
- ✅ 两种内置模板（本周上新、商品展示）
- ✅ JSON 格式输出
- ✅ 易于扩展新模板

### ✅ 通用能力
- ✅ 统一日志系统（自动脱敏）
- ✅ 标准化错误处理
- ✅ 文件自动下载和清理
- ✅ 回调签名验证（HMAC-SHA256）
- ✅ 环境变量隔离
- ✅ 临时文件自动清理

## 📁 目录结构

```
scf/
├── README.md                        # 本文档
├── deploy.sh                        # 一键部署脚本 ⭐
│
├── common/                          # 通用模块
│   ├── logger.js                    # 日志工具（自动脱敏）
│   ├── errorHandler.js              # 错误处理器
│   └── fileDownloader.js            # 文件下载工具
│
├── video-compositor/                # 视频合成云函数
│   ├── index.js                     # 主入口
│   ├── package.json
│   ├── config.js
│   ├── serverless.yml               # 部署配置
│   ├── README.md                    # 详细文档
│   └── lib/
│       ├── videoMerger.js           # 视频拼接（FFmpeg）
│       ├── subtitleOverlay.js       # 字幕叠加
│       ├── logoWatermark.js         # Logo水印
│       ├── cosUploader.js           # COS上传
│       └── callbackSender.js        # 回调发送（HMAC签名）
│
├── image-compositor/                # 图片拼接云函数
│   ├── index.js
│   ├── package.json
│   ├── config.js
│   ├── serverless.yml
│   ├── README.md
│   └── lib/
│       ├── gridLayout.js            # 九宫格布局
│       └── imageProcessor.js        # 图片处理（Sharp）
│
└── text-processor/                  # 文本处理云函数
    ├── index.js
    ├── package.json
    ├── config.js
    ├── serverless.yml
    ├── README.md
    ├── templates/                   # 文案模板
    │   ├── weekly_drop.json
    │   └── product_showcase.json
    └── lib/
        └── templateRenderer.js      # 模板渲染
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 腾讯云凭证
export TENCENT_SECRET_ID="AKIDxxxxxxxxxxxxxxxx"
export TENCENT_SECRET_KEY="xxxxxxxxxxxxxxxxxxxxxxxx"

# COS 配置
export COS_BUCKET="your-bucket-name"
export COS_REGION="ap-guangzhou"

# 后端回调配置
export BACKEND_API_URL="https://your-backend.com"
export INTERNAL_CALLBACK_SECRET="your-secret-key-here"

# 数据库加密密钥（32字节hex）
export ENCRYPTION_KEY="$(node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))')"
```

### 2. 一键部署

```bash
# 安装 Serverless Framework
npm install -g serverless

# 部署所有云函数
cd scf
bash deploy.sh
```

### 3. 初始化数据库

```bash
cd backend
npm run seed:run
```

## 🔐 安全机制

### 回调签名算法（HMAC-SHA256）

```javascript
// 拼接顺序：task_id + step_index + timestamp
const payload = `${task_id}${step_index}${timestamp}`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

// 请求头
headers: {
  'X-Internal-Signature': signature,
  'X-Timestamp': timestamp
}
```

### 环境变量隔离

所有敏感信息通过环境变量配置：
- ✅ COS 访问凭证
- ✅ 回调签名密钥
- ✅ 后端 API 地址
- ✅ 数据库加密密钥

### 日志自动脱敏

自动过滤敏感字段：`credentials`, `secret`, `password`, `token` 等

## 📊 性能指标

| 指标 | 视频合成 | 图片拼接 | 文本处理 |
|------|---------|---------|---------|
| 内存 | 3GB | 1GB | 512MB |
| 超时 | 300秒 | 60秒 | 30秒 |
| 并发建议 | 50 | 100 | 100 |

## 🚨 红线提醒

### ❌ 绝对禁止
1. 不触碰计费/配额
2. 不暴露内部接口
3. 不直接操作数据库
4. 不打印敏感信息
5. 不跳过回调验证

### ✅ 必须遵守
1. 必须回调通知后端
2. 必须清理临时文件
3. 必须签名验证
4. 必须脱敏日志

## 📚 详细文档

- [视频合成云函数](./video-compositor/README.md)
- [图片拼接云函数](./image-compositor/README.md)
- [文本处理云函数](./text-processor/README.md)

## 👥 联系信息

- 维护者: SCF Worker Team
- 文档版本: v1.0.0
- 最后更新: 2025-10-29

---

**重要提醒**：云函数直接处理生产数据，请严格遵循安全规范，确保数据安全！