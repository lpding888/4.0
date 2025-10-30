# 图片拼接云函数 (Image Compositor)

## 功能说明

生成九宫格/多图合成效果，支持：
- ✅ 多种布局（2x2, 3x3, 3x4, 4x4）
- ✅ 图片自动缩放保持宽高比
- ✅ 自定义间距和背景色
- ✅ 高性能处理（Sharp库）
- ✅ 自动上传到 COS
- ✅ 安全回调后端（HMAC-SHA256 签名）

## 环境变量配置

```bash
export TENCENT_SECRET_ID="AKIDxxxxxxxxxxxxxxxx"
export TENCENT_SECRET_KEY="xxxxxxxxxxxxxxxx"
export COS_BUCKET="your-bucket-name"
export COS_REGION="ap-guangzhou"
export BACKEND_API_URL="https://your-backend.com"
export INTERNAL_CALLBACK_SECRET="your-secret-key-here"
export APIGW_SERVICE_ID="service-xxxxxxxx"
export LOG_LEVEL="info"
```

## 请求格式

**HTTP POST**

```json
{
  "task_id": "t_abc123",
  "step_index": 1,
  "input_files": [
    "https://cos.../pose_01.jpg",
    "https://cos.../pose_02.jpg",
    "https://cos.../pose_03.jpg",
    "https://cos.../pose_04.jpg",
    "https://cos.../pose_05.jpg",
    "https://cos.../pose_06.jpg",
    "https://cos.../pose_07.jpg",
    "https://cos.../pose_08.jpg",
    "https://cos.../pose_09.jpg",
    "https://cos.../pose_10.jpg",
    "https://cos.../pose_11.jpg",
    "https://cos.../pose_12.jpg"
  ],
  "params": {
    "layout": "3x4",
    "spacing": 10,
    "background_color": "#F5F5F5"
  }
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | string | ✅ | 任务ID |
| step_index | number | ✅ | 步骤索引 |
| input_files | array | ✅ | 输入图片URL列表 |
| params.layout | string | ❌ | 布局: 2x2/3x3/3x4/4x4（默认3x4） |
| params.spacing | number | ❌ | 图片间距，像素（默认10） |
| params.background_color | string | ❌ | 背景颜色hex（默认#F5F5F5） |

### 支持的布局

- `2x2`: 2行2列（最多4张图）
- `3x3`: 3行3列（最多9张图）
- `3x4`: 3行4列（最多12张图）⭐ 默认
- `4x3`: 4行3列（最多12张图）
- `4x4`: 4行4列（最多16张图）

## 输出格式

**成功**：
```json
{
  "success": true,
  "task_id": "t_abc123",
  "step_index": 1,
  "output_url": "https://bucket.cos.ap-guangzhou.myqcloud.com/tasks/t_abc123/step_1/grid.jpg"
}
```

## 回调机制

同视频合成云函数，使用相同的签名算法。

## 部署步骤

```bash
cd scf/image-compositor
npm install --production
serverless deploy --stage prod
```

## 性能指标

- **内存**: 1GB
- **超时**: 60秒
- **并发**: 建议100以内
- **成本**: 约 ¥0.00011/GB·秒

## 技术细节

使用 **Sharp** 库进行图片处理：
- 高性能（比ImageMagick快4-5倍）
- 支持各种图片格式
- 自动内存管理
- 流式处理大图

## 示例输出

12张图片（AI模特12分镜） → 3x4九宫格

```
+-------+-------+-------+-------+
| IMG 1 | IMG 2 | IMG 3 | IMG 4 |
+-------+-------+-------+-------+
| IMG 5 | IMG 6 | IMG 7 | IMG 8 |
+-------+-------+-------+-------+
| IMG 9 |IMG 10 |IMG 11 |IMG 12 |
+-------+-------+-------+-------+
```

每张图片：512x512px
间距：10px
总尺寸：2088x1576px

## 注意事项

- 图片数量超过布局容量时自动截取前N张
- 所有图片自动调整为统一尺寸
- 使用 `fit: cover` 模式（裁剪并填充）
- 输出格式固定为 JPEG（质量90%）

## 联系信息

- 维护者: SCF Worker Team
- 文档版本: v1.0.0
