# EXAMPLES: 正确的交付方式示例

假设产品规划师新写了一个功能叫 "促销海报生成 promo_poster"。
它的意思是：商家上传商品图 + 输入价格 + 选促销主题，系统生成一张促销海报图，带文案。后端是同步生成的。

下面演示你（前端工程师）应该如何交付。

---

## 第1步：列出要改哪些前端文件（计划阶段）
你先不要写代码。你应该先输出类似：

1. `frontend-dashboard/pages/workspace/index.tsx`
   - 在工作台"功能入口卡片区域"新增一张卡片：
     - 标题：促销海报生成
     - 描述：一键生成可商用促销海报
     - 点击后跳转到新表单页 `/promo-poster/new`
     - 如果用户不是会员，从 `/membership/status` 发现 isMember=false，就弹出"开通会员"对话框，不允许进入表单页

2. `frontend-dashboard/pages/promo-poster/new.tsx`
   - 这个是创建任务表单页
   - UI结构：
     - 图片上传区（点击上传后，先调 `GET /media/sts`，拿临时STS，直传COS到 `input/{userId}/{taskId?}`。如果需要taskId占位，可以先向后端要一个临时taskId或用uuid占位，具体看后端返回的契约）
     - 促销主题选择（清仓/新品/限时折扣）
     - 价格输入框
     - "生成"按钮：点了后 `POST /task/create`:
       ```json
       {
         "type": "promo_poster",
         "inputImageUrl": "cos://input/.../original.jpg",
         "params": {
           "theme": "...",
           "price": 199
         }
       }
       ```
   - 接口返回 `taskId` 和 `status`。
   - 如果 `status === "done"`，就 `router.push("/task/" + taskId)`。
   - 如果 `status === "processing"`（假如后端后来把它做成异步了），同样跳 `router.push("/task/" + taskId)`，详情页里会轮询。

3. `frontend-dashboard/pages/task/[taskId].tsx`
   - 在详情页中，如果 `status === "processing"` -> 显示"生成中... 请稍候"
   - 如果 `status === "done"` -> 展示 `resultUrls`（海报成品图）
   - 如果 `status === "failed"` -> 展示 `errorReason` 并提供"重新生成"按钮（跳回 `/promo-poster/new`）
   - **不允许** 自己猜会员剩余次数。不允许擅自修改会员状态。
   - **不允许** 展示任何内部的 `vendorTaskId`、签名secret、回调信息。

4. 如有公用组件（例如 UploadImageCard / TaskStatusBadge），会在 `frontend-dashboard/components/` 下新增或改。

你必须先把这个清单输出给我，并声明你遵守 RULES.md。

---

## 第2步：确认红线
接下来你要写一段自查，比如：

- 我不会读/改会员配额逻辑，我只会展示 `/membership/status` 返回值。
- 我调用 `/media/sts` 获取临时凭证，直传COS，不会自己伪造COS永久写入权限。
- 我不会直接访问 `/internal/task/update`。
- 我不会把 COS 永久裸链暴露给用户，下载/预览使用后端允许的URL或安全访问路径。
- 我不会用 while(true) 去打 `/task/create` 试图压测后端或绕过限流。
- 任务详情页状态只相信后端 `/task/:id` 返回的 `status`，不会自己假装成 done。

---

## 第3步：给代码草稿 / diff
只有在上面两个步骤（文件清单 + 红线确认）通过后，你才开始吐代码（React/Next.js页面、hook、组件等）。

代码必须做到：
- 用后端返回的数据渲染UI
- 用 state 显示 loading / error / result
- 轮询时用定时器调 `GET /task/:id`，并在组件卸载时清理定时器
- 文案清楚地告诉用户"生成中""生成失败，请重试"，但不暴露内部实现细节

---

## 第4步：交付结束时的对账
在给出最终代码后，你必须再次总结：
1. 你新增/修改了哪些文件
2. 这些改动是否会影响会员扣次/返还配额（不应该直接影响）
3. 这些改动是否暴露了内部回调接口（不可以暴露）
4. 这些改动是否把COS当公开CDN（不可以）
5. 这些改动是否兼容 `/task/:id`、`/task/create`、`/membership/status` 的字段命名（必须兼容）

只要有一条回答是"是，我改坏了"，就不合格，不能合并分支，必须返工。

---

总结：
- 作为 FrontEnd Dev Skill，你不是来耍花样的。
- 你的产出必须是：文件清单 → 红线确认 → 安全合规的页面/组件代码草稿 → 最终合规对账。