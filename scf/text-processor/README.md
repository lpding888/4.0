# 文本处理云函数 (Text Processor)

## 功能说明

基于模板生成营销文案，支持：
- ✅ 模板变量替换
- ✅ 多种文案模板（本周上新、商品展示等）
- ✅ JSON 格式输出
- ✅ 自动上传到 COS
- ✅ 安全回调后端

## 环境变量配置

```bash
export TENCENT_SECRET_ID="AKIDxxxxxxxxxxxxxxxx"
export TENCENT_SECRET_KEY="xxxxxxxxxxxxxxxx"
export COS_BUCKET="your-bucket-name"
export COS_REGION="ap-guangzhou"
export BACKEND_API_URL="https://your-backend.com"
export INTERNAL_CALLBACK_SECRET="your-secret-key-here"
export LOG_LEVEL="info"
```

## 请求格式

**HTTP POST**

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

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | string | ✅ | 任务ID |
| step_index | number | ✅ | 步骤索引 |
| params.template | string | ✅ | 模板名称: weekly_drop / product_showcase |
| params.sku_names | array | ✅ | SKU名称列表 |
| params.launch_date | string | ❌ | 上新日期（如"11月1日"） |
| params.store_name | string | ❌ | 店铺名称 |

## 可用模板

### 1. weekly_drop（本周上新）

适用场景：每周新品上架预告

输出示例：
```json
{
  "template_name": "weekly_drop",
  "title": "【本周上新】3款新品2025-11-01上架",
  "description": "时尚女装旗舰店本周上新：连衣裙A、连衣裙B、连衣裙C",
  "subtitle": "💎 精选好物，抢先预览",
  "call_to_action": "直播间见，不见不散！",
  "hashtags": ["本周上新", "新品预告", "直播预告", "时尚女装"],
  "emoji_prefix": "✨",
  "footer": "更多新品敬请期待"
}
```

### 2. product_showcase（商品展示）

适用场景：商品推广宣传

输出示例：
```json
{
  "template_name": "product_showcase",
  "title": "时尚女装旗舰店 - 3款精选好物",
  "description": "为您精选：连衣裙A、连衣裙B、连衣裙C",
  "subtitle": "🛍️ 品质保证，限时特惠",
  "call_to_action": "立即选购，享受专属优惠！",
  "hashtags": ["精选好物", "品质保证", "限时特惠", "优质服务"],
  "emoji_prefix": "🎁",
  "footer": "您的满意是我们的追求"
}
```

## 输出格式

**成功**：
```json
{
  "success": true,
  "task_id": "t_abc123",
  "step_index": 1,
  "output_url": "https://bucket.cos.ap-guangzhou.myqcloud.com/tasks/t_abc123/step_1/text_bundle.json",
  "text_bundle": {
    "template_name": "weekly_drop",
    "title": "...",
    "description": "...",
    ...
  }
}
```

## 添加新模板

在 `templates/` 目录下创建新的 JSON 文件：

```json
{
  "template_name": "your_template",
  "description": "模板说明",
  "title": "标题：{{variable_name}}",
  "description": "描述：{{another_variable}}",
  "hashtags": ["标签1", "标签2"]
}
```

支持的变量：
- `{{sku_count}}` - SKU数量
- `{{sku_list}}` - SKU列表（用顿号分隔）
- `{{launch_date}}` - 上新日期
- `{{store_name}}` - 店铺名称

## 部署步骤

```bash
cd scf/text-processor
npm install --production
serverless deploy --stage prod
```

## 性能指标

- **内存**: 512MB
- **超时**: 30秒
- **并发**: 建议100以内
- **成本**: 约 ¥0.00011/GB·秒

## 注意事项

⚠️ **模板规范**:
- 禁止调用外部 AI 生成接口（文案必须基于模板）
- 禁止在云函数中做内容审核
- 模板文件必须随代码打包部署

⚠️ **安全规范**:
- 所有模板变量自动转义
- 不允许执行用户输入的代码
- 输出固定为 JSON 格式

## 联系信息

- 维护者: SCF Worker Team
- 文档版本: v1.0.0
