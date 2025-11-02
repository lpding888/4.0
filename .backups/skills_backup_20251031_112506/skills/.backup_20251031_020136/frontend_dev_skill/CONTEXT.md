# CONTEXT: 前端当前项目模型

## 1. 我们的产品UI大结构
- 登录/注册页（手机号+验证码）
- 会员购买页（展示权益、拉起支付）
- 工作台首页：
  - 顶部会员卡片（剩余次数 / 到期时间）
  - 功能入口卡片（例如"服装清理增强""AI模特12分镜"等）
  - 最近任务列表（缩略图 + 状态 + 创建时间）
- 任务创建表单页：
  - 上传图片（通过 /media/sts -> COS 直传）
  - 选择参数（场景/风格/价格等）
  - 点击"生成" => POST /task/create
- 任务详情页：
  - 显示任务状态条（processing / done / failed）
  - 展示结果图（resultUrls）
  - 提供"下载"或"查看大图"

这些页面基本在 `frontend-dashboard/` （或类似命名） 下面的路由里实现。

## 2. 前端和后端之间的核心接口
- `GET /membership/status`
  - 返回：
    - isMember (bool)
    - quota_remaining (number)
    - quota_expireAt (ISO时间字符串)
    - expireDays (剩余天数)
  - 你把这些展示在工作台顶部会员卡片里

- `GET /media/sts`
  - 返回临时凭证，让你用 COS SDK 或直传把用户上传的原图放到
    `input/{userId}/{taskId}/original.jpg`
  - 这个请求通常需要带上当前"我要创建的任务"的临时ID或上下文
  - 前端负责直传，不要通过自己搭的中转服务

- `POST /task/create`
  - 请求体含：
    - type: 任务类型，比如 "basic_clean", "model_pose12", "promo_poster"
    - inputImageUrl: COS 上用户原图的路径
    - params: { ... } 用户选择的表单参数（风格、文案、价格等）
  - 响应：
    - taskId
    - status （对同步型任务，可能直接是 "done"）
    - 可能还有基础信息（比如创建时间）

- `GET /task/:taskId`
  - 返回：
    - id, type
    - status: "processing" | "done" | "failed"
    - resultUrls: 图片结果数组（done 时才会有）
    - errorReason（failed 时）
    - createdAt / updatedAt
  - 前端的任务详情页会轮询它（例如每3秒），直到 status = done 或 failed

- `GET /task/list?limit=10`
  - 用于"最近任务列表"，显示缩略图、状态、时间

## 3. 类型差异：同步任务 vs 异步任务
- 同步任务（例如"服装清理增强"）
  - 用户一提交就拿到结果（服务端实时完成）
  - 前端提交流程：
    - 上传 -> POST /task/create -> 服务器返回就是 done
    - 直接跳到详情页，展示现成的 resultUrls
  - 几乎不需要轮询

- 异步任务（例如"AI模特12分镜"）
  - 后端会先扣次并返回 taskId，但是图片生成需要几分钟
  - 前端跳转到任务详情页，轮询 GET /task/:id
  - 状态可能长时间是 "processing"
  - UI 必须支持 loading 状态，并允许运行中展示"生成中..."等提示

当你加新功能卡时，必须在UI里清楚地表达这是"实时出图"还是"后台生成中，稍后完成"。

## 4. 结果展示
- `resultUrls` 是数组
  - 对同步修图，通常只有 1 张
  - 对"12分镜"会有多张
  - 将它们以网格/瀑布流展示，点击可放大
- 下载按钮：
  - 只能指向允许公开给用户的安全地址（受控URL）
  - 不要自己构造裸COS路径让用户直接深链桶

## 5. 错误状态和提示
- 如果 status = "failed"
  - 展示后端给的 errorReason（例如"内容违规""生成超时，请稍后重试"）
  - 提示用户可以重试（比如"重新生成"按钮，重新走创建流程）
- 这些提示文案请保持礼貌、清晰，不要暴露我们内部实现细节（比如供应商名字、vendorTaskId、签名secret等）

## 6. 视觉/布局方向（MVP 默认）
- 风格：半透明卡片 + 深色/蓝青渐变背景（类似玻璃拟态，高感服饰科技感）
- 工作台：顶部是会员卡、下面是功能卡，再往下是最近任务
- 任务详情页：顶部是任务标题+状态，下面是输出内容区域（图网格），底部是下载操作

你在写页面草稿时，UI不需要100%像最终成品，但必须留出这些结构块（会员卡、入口卡片、轮询中的loading state、错误state、结果预览）。