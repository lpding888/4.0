# SCF Worker Skill - 任务卡清单

## 任务1:视频合成云函数 - 多SKU合辑短片

**产出物**:
- `scf/video-compositor/index.js` (主函数)
- `scf/video-compositor/package.json`
- `scf/video-compositor/config.js`
- `scf/video-compositor/lib/videoMerger.js` (视频拼接)
- `scf/video-compositor/lib/subtitleOverlay.js` (字幕叠加)
- `scf/video-compositor/lib/logoWatermark.js` (Logo水印)
- `scf/video-compositor/lib/cosUploader.js` (COS上传)
- `scf/video-compositor/lib/callbackSender.js` (回调发送)

**执行内容**:

### 1.1 函数入口
**触发方式**: HTTP POST  
**请求体**:
```json
{
  "task_id": "t_abc123",
  "step_index": 1,
  "input_files": [
    "https://cos.../video_fragment_1.mp4",
    "https://cos.../video_fragment_2.mp4"
  ],
  "params": {
    "logo_url": "https://cos.../logo.png",
    "tagline": "本周上新,直播见",
    "launch_date": "2025-11-01",
    "subtitle_position": "bottom",
    "subtitle_font_size": 48
  }
}
```

### 1.2 处理流程
```javascript
exports.main_handler = async (event) => {
  const { task_id, step_index, input_files, params } = JSON.parse(event.body);
  
  try {
    // 1. 下载输入文件到 /tmp
    const localFiles = await downloadFiles(input_files);
    
    // 2. 拼接视频片段
    const mergedVideo = await videoMerger.merge(localFiles, {
      transition: 'fade', // 转场效果
      duration: 'auto'
    });
    
    // 3. 叠加字幕
    const withSubtitle = await subtitleOverlay.add(mergedVideo, {
      text: `${params.tagline}\n${params.launch_date}`,
      position: params.subtitle_position,
      fontSize: params.subtitle_font_size,
      fontColor: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.5)'
    });
    
    // 4. 添加 Logo 水印
    const finalVideo = await logoWatermark.add(withSubtitle, {
      logoUrl: params.logo_url,
      position: 'top-right',
      scale: 0.15,
      opacity: 0.8
    });
    
    // 5. 上传到 COS
    const outputUrl = await cosUploader.upload(finalVideo, {
      bucket: process.env.COS_BUCKET,
      path: `tasks/${task_id}/step_${step_index}/output.mp4`
    });
    
    // 6. 回调后端
    await callbackSender.send({
      task_id: task_id,
      step_index: step_index,
      status: 'success',
      output_url: outputUrl
    });
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
    
  } catch (error) {
    // 失败时也要回调
    await callbackSender.send({
      task_id: task_id,
      step_index: step_index,
      status: 'failed',
      error_message: error.message
    });
    
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```

### 1.3 回调发送器 (callbackSender.js)
```javascript
const crypto = require('crypto');
const axios = require('axios');

async function send({ task_id, step_index, status, output_url, error_message }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.INTERNAL_CALLBACK_SECRET;
  
  // 计算签名(与后端一致: task_id + step_index + timestamp)
  const payload = `${task_id}${step_index}${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  
  // 发送回调
  await axios.post(
    `${process.env.BACKEND_API_URL}/api/internal/tasks/${task_id}/steps/${step_index}/callback`,
    {
      status: status,
      output_url: output_url,
      error_message: error_message
    },
    {
      headers: {
        'X-Internal-Signature': signature,
        'X-Timestamp': timestamp
      },
      timeout: 10000
    }
  );
}

module.exports = { send };
```

**重要**: 签名算法必须与后端 verifyInternalSignature 中间件保持一致,payload 拼接顺序为 `task_id + step_index + timestamp`,输出为 hex digest。

**验收标准**:
- 能正确拼接多个视频片段
- 字幕清晰可读,位置可配置
- Logo 水印不遮挡主体内容
- 回调签名正确(同后端 verifyInternalSignature 一致),后端能验证通过
- 失败时也发送回调,不会导致任务挂起
- 回调签名规则已文档化

**禁止事项**:
- 禁止直接操作数据库(任何表)
- 禁止直接修改 tasks 或 users 表
- 禁止跳过回调,直接返回结果
- 禁止在日志中打印敏感信息(密钥、用户ID)
- 禁止发送未签名回调请求

**依赖项**:
- FFmpeg 已安装在云函数环境
- COS SDK 已配置
- 环境变量 INTERNAL_CALLBACK_SECRET、BACKEND_API_URL 已设置

---

## 任务2:图片拼接云函数 - 九宫格/多图合成

**产出物**:
- `scf/image-compositor/index.js`
- `scf/image-compositor/lib/gridLayout.js` (九宫格布局)
- `scf/image-compositor/lib/imageProcessor.js` (图片处理)

**执行内容**:

### 2.1 函数入口
**请求体**:
```json
{
  "task_id": "t_abc123",
  "step_index": 1,
  "input_files": [
    "https://cos.../pose_1.jpg",
    "https://cos.../pose_2.jpg",
    "... 12张图"
  ],
  "params": {
    "layout": "3x4",
    "spacing": 10,
    "background_color": "#F5F5F5"
  }
}
```

### 2.2 处理流程
```javascript
exports.main_handler = async (event) => {
  const { task_id, step_index, input_files, params } = JSON.parse(event.body);
  
  try {
    // 1. 下载所有图片
    const images = await downloadFiles(input_files);
    
    // 2. 生成九宫格
    const grid = await gridLayout.create(images, {
      layout: params.layout, // "3x4" 表示 3 列 4 行
      spacing: params.spacing,
      backgroundColor: params.background_color,
      imageWidth: 512,
      imageHeight: 512
    });
    
    // 3. 上传到 COS
    const outputUrl = await cosUploader.upload(grid, {
      bucket: process.env.COS_BUCKET,
      path: `tasks/${task_id}/step_${step_index}/grid.jpg`
    });
    
    // 4. 回调后端
    await callbackSender.send({
      task_id: task_id,
      step_index: step_index,
      status: 'success',
      output_url: outputUrl
    });
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
    
  } catch (error) {
    await callbackSender.send({
      task_id: task_id,
      step_index: step_index,
      status: 'failed',
      error_message: error.message
    });
    
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```

**验收标准**:
- 支持不同布局(2x2、3x3、3x4、4x4)
- 图片尺寸自动缩放,保持宽高比
- 间距和背景色可配置
- 输出图片清晰,无压缩失真

**禁止事项**:
- 禁止直接操作数据库
- 禁止硬编码 COS 桶名

**依赖项**:
- Sharp 或 Canvas 库已安装
- COS SDK 已配置

---

## 任务3:文本处理云函数 - 文案生成/格式化

**产出物**:
- `scf/text-processor/index.js`
- `scf/text-processor/lib/templateRenderer.js` (模板渲染)

**执行内容**:

### 3.1 函数入口
**请求体**:
```json
{
  "task_id": "t_abc123",
  "step_index": 1,
  "input_files": [],
  "params": {
    "template": "weekly_drop",
    "sku_names": ["连衣裙A", "连衣裙B", "连衣裙C"],
    "launch_date": "2025-11-01",
    "store_name": "时尚女装旗舰店"
  }
}
```

### 3.2 处理流程
```javascript
exports.main_handler = async (event) => {
  const { task_id, step_index, params } = JSON.parse(event.body);
  
  try {
    // 1. 渲染文案模板
    const textBundle = await templateRenderer.render(params.template, {
      skuNames: params.sku_names,
      launchDate: params.launch_date,
      storeName: params.store_name
    });
    
    // 示例输出:
    // {
    //   "title": "【本周上新】3款新品11月1日上架",
    //   "description": "时尚女装旗舰店本周上新:连衣裙A、连衣裙B、连衣裙C",
    //   "hashtags": ["本周上新", "新品预告", "直播预告"]
    // }
    
    // 2. 保存为 JSON 文件上传到 COS
    const outputUrl = await cosUploader.upload(JSON.stringify(textBundle), {
      bucket: process.env.COS_BUCKET,
      path: `tasks/${task_id}/step_${step_index}/text_bundle.json`,
      contentType: 'application/json'
    });
    
    // 3. 回调后端
    await callbackSender.send({
      task_id: task_id,
      step_index: step_index,
      status: 'success',
      output_url: outputUrl
    });
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
    
  } catch (error) {
    await callbackSender.send({
      task_id: task_id,
      step_index: step_index,
      status: 'failed',
      error_message: error.message
    });
    
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```

**验收标准**:
- 支持多种文案模板
- 模板变量正确替换
- 输出 JSON 格式正确

**禁止事项**:
- 禁止调用外部 AI 生成接口(文案必须基于模板)
- 禁止在云函数中做内容审核

**依赖项**:
- 模板文件已预置在云函数代码包中

---

## 任务4:云函数部署和环境配置

**产出物**:
- `scf/video-compositor/serverless.yml` (腾讯云 SCF 配置)
- `scf/image-compositor/serverless.yml`
- `scf/text-processor/serverless.yml`
- `scf/deploy.sh` (部署脚本)

**执行内容**:

### 4.1 serverless.yml 示例 (video-compositor)
```yaml
service: video-compositor

provider:
  name: tencentcloud
  runtime: Nodejs14.18
  region: ap-guangzhou
  memorySize: 3072
  timeout: 300
  environment:
    COS_BUCKET: ${env:COS_BUCKET}
    COS_REGION: ${env:COS_REGION}
    INTERNAL_CALLBACK_SECRET: ${env:INTERNAL_CALLBACK_SECRET}
    BACKEND_API_URL: ${env:BACKEND_API_URL}

functions:
  compositor:
    handler: index.main_handler
    events:
      - apigw:
          name: video-compositor-api
          parameters:
            serviceId: ${env:APIGW_SERVICE_ID}
            environment: release
            endpoints:
              - path: /
                method: POST

layers:
  - name: ffmpeg-layer
    version: 1
```

### 4.2 部署脚本 (deploy.sh)
```bash
#!/bin/bash

# 部署视频合成函数
cd scf/video-compositor
npm install --production
serverless deploy --stage prod

# 部署图片拼接函数
cd ../image-compositor
npm install --production
serverless deploy --stage prod

# 部署文本处理函数
cd ../text-processor
npm install --production
serverless deploy --stage prod

echo "所有云函数部署完成"
```

**验收标准**:
- 云函数能正常触发和执行
- 环境变量正确配置,不硬编码
- 内存和超时时间配置合理(视频处理至少 3GB 内存,300秒超时)
- Layer 中包含 FFmpeg (用于视频处理)

**禁止事项**:
- 禁止在代码中硬编码密钥
- 禁止使用小于 2GB 的内存配置(视频处理会 OOM)

**依赖项**:
- Serverless Framework 已安装
- 腾讯云账号已配置 AKSK
- COS 桶已创建

---

## 任务5:provider_endpoints 表数据初始化

**产出物**:
- `backend/src/db/seeds/002_provider_endpoints.js`

**执行内容**:

### 5.1 Seed 数据
```javascript
exports.seed = async function(knex) {
  await knex('provider_endpoints').del();
  
  await knex('provider_endpoints').insert([
    {
      provider_ref: 'internal_scf_video_compositor',
      provider_name: '内部视频合成服务',
      endpoint_url: process.env.SCF_VIDEO_COMPOSITOR_URL,
      credentials_encrypted: encrypt(process.env.INTERNAL_CALLBACK_SECRET),
      auth_type: 'hmac'
    },
    {
      provider_ref: 'internal_scf_image_compositor',
      provider_name: '内部图片拼接服务',
      endpoint_url: process.env.SCF_IMAGE_COMPOSITOR_URL,
      credentials_encrypted: encrypt(process.env.INTERNAL_CALLBACK_SECRET),
      auth_type: 'hmac'
    },
    {
      provider_ref: 'internal_scf_text_processor',
      provider_name: '内部文案处理服务',
      endpoint_url: process.env.SCF_TEXT_PROCESSOR_URL,
      credentials_encrypted: encrypt(process.env.INTERNAL_CALLBACK_SECRET),
      auth_type: 'hmac'
    }
  ]);
};

function encrypt(text) {
  // 使用 KMS 或简单加密
  const crypto = require('crypto');
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}
```

**验收标准**:
- Seed 数据能正确插入 provider_endpoints 表
- credentials 已加密,不是明文
- endpoint_url 从环境变量读取,不硬编码

**禁止事项**:
- 禁止明文存储 INTERNAL_CALLBACK_SECRET
- 禁止硬编码云函数 URL

**依赖项**:
- 云函数已部署,拿到正式 URL
- 环境变量已配置

---

## 任务6:错误处理和日志规范

**产出物**:
- `scf/common/errorHandler.js` (通用错误处理)
- `scf/common/logger.js` (日志工具)

**执行内容**:

### 6.1 错误处理规范
```javascript
// errorHandler.js
class SCFError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function handleError(error, context) {
  // 记录错误日志
  logger.error('SCF执行失败', {
    error: error.message,
    stack: error.stack,
    context: context
  });
  
  // 返回标准错误响应
  return {
    statusCode: error.code || 500,
    body: JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  };
}

module.exports = { SCFError, handleError };
```

### 6.2 日志规范
```javascript
// logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});

// 禁止打印敏感信息
function sanitize(data) {
  const sanitized = { ...data };
  delete sanitized.credentials;
  delete sanitized.secret;
  delete sanitized.password;
  return sanitized;
}

module.exports = {
  info: (message, data) => logger.info(message, sanitize(data)),
  error: (message, data) => logger.error(message, sanitize(data)),
  warn: (message, data) => logger.warn(message, sanitize(data))
};
```

**验收标准**:
- 所有错误都被捕获并记录
- 日志不包含敏感信息(密钥、用户密码等)
- 日志格式统一,便于检索

**禁止事项**:
- 禁止在日志中打印完整请求体(可能包含敏感信息)
- 禁止在控制台直接 console.log(必须使用 logger)

**依赖项**:
- winston 库已安装

---

## 依赖规范

### 回调契约
1. **回调URL**: `POST /api/internal/tasks/:taskId/steps/:stepIndex/callback`
2. **签名算法**: HMAC-SHA256(task_id + step_index + timestamp + secret)
   - **payload 拼接顺序**: `task_id + step_index + timestamp`(不包含 secret)
   - **输出格式**: hex digest
   - **后端验证逻辑**: 使用同样 payload 重新计算签名,比较 X-Internal-Signature header
3. **请求头**:
   - X-Internal-Signature: 签名
   - X-Timestamp: Unix 时间戳
4. **请求体**:
   ```json
   {
     "status": "success" | "failed",
     "output_url": "https://cos.../output.mp4",
     "error_message": "错误原因"
   }
   ```
5. **时间戳验证**: 后端会检查时间戳在5分钟内,超过则返回 401

### 职责边界
1. **只处理后处理任务**: 不负责调用外部 AI 生成(那是 RUNNINGHUB_WORKFLOW 的职责)
2. **不操作数据库**: 只能通过回调接口更新状态(禁止直连任何数据库表)
3. **不扣费**: 配额扣减由后端主流程负责
4. **不做内容审核**: 质量验收在 is_enabled 阶段,不在运行时

### 安全要求
1. **回调签名必填**: 每次回调必须计算签名
2. **环境变量隔离**: 不在代码中硬编码密钥、域名、桶名
3. **日志脱敏**: 不打印敏感信息

### 性能要求
1. **超时配置**: 视频处理至少 300 秒,图片处理至少 60 秒
2. **内存配置**: 视频处理至少 3GB,图片处理至少 1GB
3. **并发限制**: 单函数并发不超过 100(避免 COS 带宽打满)

### 存储规范
1. **输出路径**: `tasks/{task_id}/step_{step_index}/output.{ext}`
2. **临时文件清理**: /tmp 目录在函数结束前清理
3. **COS桶隔离**: 开发环境和生产环境使用不同 COS 桶

### 交付标准
- 所有云函数通过本地测试
- 部署到测试环境并验证回调成功
- 提供云函数调用日志截图
- 文档说明环境变量配置方法
