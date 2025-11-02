# 视频合成云函数 (Video Compositor)

## 功能说明

处理多SKU视频合辑短片，支持：
- ✅ 多个视频片段拼接（转场效果）
- ✅ 字幕叠加（自定义文本、位置、样式）
- ✅ Logo 水印（自定义位置、缩放、透明度）
- ✅ 自动上传到 COS
- ✅ 安全回调后端（HMAC-SHA256 签名）

## 环境变量配置

部署前必须配置以下环境变量：

```bash
# 腾讯云凭证
export TENCENT_SECRET_ID="AKIDxxxxxxxxxxxxxxxx"
export TENCENT_SECRET_KEY="xxxxxxxxxxxxxxxx"

# COS 配置
export COS_BUCKET="your-bucket-name"
export COS_REGION="ap-guangzhou"

# 后端回调配置
export BACKEND_API_URL="https://your-backend.com"
export INTERNAL_CALLBACK_SECRET="your-secret-key-here"

# API网关配置（可选）
export APIGW_SERVICE_ID="service-xxxxxxxx"
export APIGW_ENVIRONMENT="release"

# FFmpeg Layer 版本（可选）
export FFMPEG_LAYER_VERSION="1"
export FONTS_LAYER_VERSION="1"

# 日志级别（可选）
export LOG_LEVEL="info"
```

## 请求格式

**HTTP POST** 到 API 网关触发器

```json
{
  "task_id": "t_abc123",
  "step_index": 1,
  "input_files": [
    "https://cos.../video_fragment_1.mp4",
    "https://cos.../video_fragment_2.mp4",
    "https://cos.../video_fragment_3.mp4"
  ],
  "params": {
    "logo_url": "https://cos.../logo.png",
    "tagline": "本周上新,直播见",
    "launch_date": "2025-11-01",
    "subtitle_position": "bottom",
    "subtitle_font_size": 48,
    "logo_position": "top-right",
    "logo_scale": 0.15,
    "logo_opacity": 0.8,
    "transition": "fade",
    "transition_duration": 1
  }
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | string | ✅ | 任务ID |
| step_index | number | ✅ | 步骤索引 |
| input_files | array | ✅ | 输入视频文件URL列表 |
| params.logo_url | string | ❌ | Logo图片URL |
| params.tagline | string | ❌ | 字幕第一行文本 |
| params.launch_date | string | ❌ | 字幕第二行文本（上新日期） |
| params.subtitle_position | string | ❌ | 字幕位置: top/center/bottom（默认bottom） |
| params.subtitle_font_size | number | ❌ | 字体大小（默认48） |
| params.logo_position | string | ❌ | Logo位置（默认top-right） |
| params.logo_scale | number | ❌ | Logo缩放比例（默认0.15） |
| params.logo_opacity | number | ❌ | Logo透明度0-1（默认0.8） |
| params.transition | string | ❌ | 转场效果: fade/none（默认fade） |

## 输出格式

**成功**：
```json
{
  "success": true,
  "task_id": "t_abc123",
  "step_index": 1,
  "output_url": "https://bucket.cos.ap-guangzhou.myqcloud.com/tasks/t_abc123/step_1/output.mp4"
}
```

**失败**：
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 回调机制

无论成功或失败，云函数都会向后端发送回调：

**回调URL**: `POST ${BACKEND_API_URL}/api/internal/tasks/:taskId/steps/:stepIndex/callback`

**请求头**:
- `X-Internal-Signature`: HMAC-SHA256 签名
- `X-Timestamp`: Unix 时间戳

**签名算法**:
```javascript
const payload = `${task_id}${step_index}${timestamp}`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
```

**请求体**:
```json
{
  "status": "success",
  "output_url": "https://...",
  "error_message": null
}
```

## 部署步骤

### 1. 安装依赖

```bash
cd scf/video-compositor
npm install --production
```

### 2. 配置环境变量

确保已设置所有必需的环境变量（见上文）

### 3. 部署到腾讯云

```bash
serverless deploy --stage prod
```

### 4. 验证部署

```bash
# 记录部署后的 API 网关 URL
# 使用 curl 或 Postman 测试
curl -X POST <API_URL> \
  -H "Content-Type: application/json" \
  -d '{"task_id":"test","step_index":1,"input_files":["..."],"params":{}}'
```

## FFmpeg Layer 准备

腾讯云 SCF 需要 FFmpeg Layer，包含：
- `/opt/bin/ffmpeg` - FFmpeg 可执行文件
- `/opt/fonts/SourceHanSansCN-Regular.otf` - 思源黑体（支持中文）

创建 Layer 的步骤：
1. 准备 FFmpeg 静态编译版本
2. 准备字体文件
3. 打包为 ZIP（按 /opt 目录结构）
4. 在腾讯云控制台创建 Layer
5. 在 serverless.yml 中引用 Layer 版本号

## 本地测试

```bash
# 设置环境变量
export TENCENT_SECRET_ID="..."
export INTERNAL_CALLBACK_SECRET="..."

# 运行测试
node test/local-test.js
```

## 性能指标

- **内存**: 3GB（视频处理需要）
- **超时**: 300秒（5分钟）
- **并发**: 建议限制在 100 以内
- **成本**: 约 ¥0.00011/GB·秒

## 注意事项

⚠️ **安全规范**:
- 禁止在代码中硬编码密钥
- 禁止在日志中打印敏感信息
- 禁止跳过回调签名

⚠️ **性能优化**:
- 临时文件自动清理
- 大文件使用流式处理
- 回调失败自动重试

⚠️ **错误处理**:
- 所有异常都被捕获并记录
- 失败时发送回调通知后端
- 配额由后端自动返还

## 故障排查

**问题1: FFmpeg 找不到**
- 检查 Layer 是否正确配置
- 检查 FFMPEG_PATH 环境变量

**问题2: 字体显示乱码**
- 检查字体 Layer 是否包含中文字体
- 检查字体路径是否正确

**问题3: 回调签名验证失败**
- 检查 INTERNAL_CALLBACK_SECRET 是否与后端一致
- 检查签名算法实现是否正确
- 检查时间戳是否在5分钟内

**问题4: COS 上传失败**
- 检查 COS 凭证是否正确
- 检查桶名和地域配置
- 检查 SCF 的网络配置

## 联系信息

- 维护者: SCF Worker Team
- 文档版本: v1.0.0
- 最后更新: 2025-10-29
