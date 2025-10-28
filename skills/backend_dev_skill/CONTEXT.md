# CONTEXT: 现有平台骨架 (必须遵守的事实)

## 1. 产品是什么
我们是一个服装AI生成/处理平台，核心能力：
- 基础修图（抠背景、白底、提亮、去杂乱），用腾讯数据万象走同步处理
- AI模特上身 / 12分镜，以 RunningHub 等外部工作流去生成，走异步
- 后续会增加促销海报、上新海报、直播封面等

业务规则：用户是会员才可以用，按“次数”计费。

## 2. 数据库核心表
### users
- id
- phone
- isMember (bool)
- quota_remaining (int)
- quota_expireAt (datetime)

### tasks
- id
- userId
- type (string) 例: "basic_clean", "model_pose12", "promo_poster" ...
- status ("processing" | "done" | "failed")
- inputUrl (string) 原始图 COS 路径
- resultUrls (json array of strings) 生成结果 COS 路径数组
- vendorTaskId (string | null) 外部AI的任务ID
- params (json) 用户选择的选项（风格/场景/价格等）
- errorReason (string | null)
- timestamps

### orders
- id
- userId
- status (pending/paid/failed)
- amount
- channel (wx/alipay)
- paidAt
- transactionId (外部支付单号)

## 3. 标准后端接口（已有或约定）
- POST /auth/send-code
- POST /auth/login
- GET  /auth/me
- GET  /membership/status
- POST /membership/purchase
- POST /membership/payment-callback
- GET  /media/sts
- POST /task/create
- GET  /task/:taskId
- GET  /task/list
- POST /internal/task/update   ← 内部安全回调（不可公开）

你可以扩展 /task/create 让它支持新的任务类型，但不要随便创建一堆新公开端点，尤其是类似 `/internal/task/update` 这种内部专用接口，不能暴露成公开。

## 4. 典型同步 vs 异步
- 同步型（例：basic_clean）
  1. /task/create 里直接调腾讯数据万象（云内处理）
  2. 拿到结果后上传到 COS /output/{userId}/{taskId}/result.jpg
  3. 更新任务为 done + resultUrls
  4. 返回给前端的 taskId 此时已经是完成态

- 异步型（例：model_pose12）
  1. /task/create 里扣次+入库 status=processing
  2. 调 RunningHub，拿到 vendorTaskId，写入任务
  3. 前端跳转任务详情页开始轮询
  4. 后端通过 /task/:id 查询 RunningHub 状态 or 等 SCF 回调
  5. 成功后任务 done + resultUrls
  6. 失败后任务 failed + errorReason + 返还配额1次

你在加新类型（比如 promo_poster）时，必须清楚它属于哪种：同步型 or 异步型。同步型可以直接在 /task/create 里结束。异步型需要 vendorTaskId+轮询+internal回调。

## 5. COS 和图片
COS 目录规范：
- input/{userId}/{taskId}/original.jpg        ← 用户上传原图（直传STS）
- output/{userId}/{taskId}/*.jpg or *.png     ← 我们/供应商生成的成品图

后端永远把成品图的路径写入 `tasks.resultUrls`，前端页面拿这些地址去展示（通过受控的访问方式）。后端不能把整个COS桶设成裸公开CDN。

## 6. 安全/审核
所有生成的结果（图/视频）在给前端之前，都要通过内容审核（涉黄、涉违禁）。如果审核不过：
- 这个任务标 failed
- 返还用户配额1次
- 不给可下载链接

你不能移除这个审核逻辑，也不能把违规图直接返回给用户。

## 7. 限流
- 短信验证码：手机号和IP都有限流，避免被刷爆成本
- 高成本任务：比如视频、超大分镜，要限“同一用户每60秒只能建1个”
- 你不能在后端删除/放宽限流，不写说明
