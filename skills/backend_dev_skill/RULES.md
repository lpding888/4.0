# RULES: 绝对不能破的后端红线

你是服务器后端实现代理。以下规定是红线，任何代码都必须遵守。

## 1. 会员 & 配额规则（计费安全）
- 创建任务时必须检查：
  - 用户是否已登录
  - 用户是否是有效会员 (isMember === true)
  - 会员是否未过期 (now < quota_expireAt)
  - 用户剩余额度 quota_remaining > 0
- 创建任务时，必须“预扣 1 次”。也就是立刻 quota_remaining = quota_remaining - 1
- quota_remaining 永远不能小于 0
- 任务成功完成：这 1 次不会退回
- 任务失败 / 超时 / 审核违规：这 1 次必须退回
- 配额扣减 / 返还只能由后端业务逻辑完成，其他模块（前端、SCF、回调）无权直接改数据库配额

⚠ 你禁止：
- 绕过预扣
- 允许 quota_remaining 变负数
- 偷偷给某类任务不扣次数
- 允许未付费用户创建高成本任务

这些是计费模型的生命线。不能破。

## 2. 任务生命周期 / 状态机
每个任务在 tasks 表里有字段：
- `type` (任务类型，比如 "basic_clean", "model_pose12", "promo_poster", ...)
- `status`: "processing" → "done" or "failed"
- `vendorTaskId`: 如果调用了外部供应商（例如 RunningHub），我们会存这个ID
- `resultUrls`: 成功时保存结果资源的 URL 列表（COS 上的 /output/...）
- `errorReason`: 如果失败，写具体原因

当用户创建任务时：
1. 校验 + 预扣 + 入库：`status=processing`
2. 根据类型走不同方案：
   - 同步型：后端直接完成处理，生成结果图，写 COS，然后把任务标成 `done`，写 `resultUrls`
   - 异步型：后端调用外部供应商，获得 `vendorTaskId`，存进任务，先不完成。前端后续通过 `/task/:id` 或回调，看状态更新

当任务最终失败：
- 更新 status = "failed"
- 写 errorReason
- 返还配额 1 次（注意幂等，不能返还多次）

## 3. /task/create 接口
你可以扩展它支持新的 `type`，但你必须保留它现在的基本流程：
- 校验会员与配额
- 预扣 1 次（原子操作，保证 quota_remaining >= 0）
- 创建任务记录（status=processing）
- 根据 type 分支处理：
  - 如果是同步型能力：直接做生成，产出后写 COS，标 done，resultUrls 填好
  - 如果是异步型：调用供应商API，拿到 vendorTaskId 写入 DB，保持 processing 状态
- 返回 taskId 给前端

你不可以：
- 拿掉预扣
- 绕过会员校验
- 跳过 DB 任务记录
- 直接把供应商的密钥、内部回调 secret 回给前端

## 4. /task/:id 查询接口
这个接口返回：
- status
- resultUrls
- errorReason
- createdAt / updatedAt
- type

你可以：
- 增加新类型的状态解释（比如“正在合成促销海报”），但不能删除已有字段，也不能改字段名。保持向后兼容。

前端轮询靠这个接口，所以字段名必须稳定。

## 5. 内部回调 /internal/task/update
- 这是 SCF 或我们自己的安全后端在走的内部回调，用来把异步任务最终状态“落地”到 DB。
- 这个接口必须要求签名/密钥验证，不能开放给普通前端。
- 正常流程：
  - SCF / 异步Worker 把生成结果放到 COS `/output/{userId}/{taskId}/...`
  - 然后调用 `/internal/task/update`，带上 taskId + status=done/failed + resultUrls/errorReason
  - 后端更新 DB
  - 后端如果 failed 则返还 1 次配额
- 你禁止：
  - 把 `/internal/task/update` 暴露给浏览器
  - 允许无签名的公开调用
  - 允许前端带着任意 taskId 去伪造“完成”

## 6. COS / 图片访问安全
- 用户原图放在 `input/{userId}/{taskId}/...`
- 处理后结果放在 `output/{userId}/{taskId}/...`
- 这些资源要么是受控访问（签名URL、防盗链），要么通过后端中转
- 禁止把 COS 整个桶直接设成“公开所有人随便访问的CDN”，不可以输出永久裸链给前端

作为后端开发，你不能交付“公开一切的静态CDN”这种改动。这属于安全红线。

## 7. 速率限制 / 防滥用
- 短信验证码发送接口必须有节流（手机号冷却+IP冷却）
- 高成本任务（例如视频生成、12分镜大模型渲染）必须有限流（比如同用户60秒只能建1个）
- 你不能删除、放宽这些限制，而不写出明确理由

## 8. 你的权限边界
- 你可以：写 controller/service、扩展任务类型逻辑、接入腾讯数据万象或 RunningHub、写入 COS、更新任务行
- 你不可以：
  - 直接返回供应商密钥到前端
  - 修改配额逻辑的基础规则
  - 改鉴权，让匿名或非会员用高成本服务
  - 绕过内容审核流程

总结：你的工作是“新增后端功能（新任务类型、新处理流程等）”，并保证它在我们已有的计费/配额/安全体系内运行，而不是发明一套新的账本。
