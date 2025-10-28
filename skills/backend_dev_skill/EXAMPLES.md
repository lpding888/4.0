# EXAMPLES: 如何正确交付一个新任务类型

示例场景：我们要新增任务类型 "promo_poster"（促销海报图）

业务描述（来自产品 PRD）：
- 用户上传商品图
- 选择促销主题（清仓 / 新品 / 限时折扣）
- 填一个价格，比如 199
- 系统生成电商风格的促销海报图 + 可用于朋友圈的小文案
- 我们走“同步型”流程，直接拿腾讯数据万象或内部Composition逻辑合成
- 最后结果是1~3张图，落到 COS /output/{userId}/{taskId}/poster_*.jpg

计费策略：
- 扣1次配额（创建时直接扣）
- 成功不返还
- 如果失败或安全审核不过 → 任务failed并返还1次

现在，后端实现步骤应该怎么走？按顺序：

1. 入口：扩展 POST /task/create
   - 新增分支：`if (type === "promo_poster") { ... }`
   - 做标准校验：
     - 登录校验
     - isMember=true
     - quota_remaining>0 AND not expired
   - 预扣1次配额（原子操作，禁止负数）
   - 写 tasks 表一行：status="processing"，type="promo_poster"，保存 inputUrl、params

2. 处理：
   - 因为这是同步型：
     - 直接在这个请求里调用我们封装的“海报生成函数”（比如一个 service/promoPosterService.ts）
     - 传入 COS 的原图URL和用户选择的主题/价格
     - 这个函数内部去调腾讯数据万象/模板合成/加文案
     - 拿到生成好的图（Buffer 或临时URL），上传到 COS /output/{userId}/{taskId}/poster_001.jpg ...
     - 收集这些输出路径到数组 resultUrls

3. 安全审核：
   - 对 resultUrls 逐张跑内容审核（涉黄/敏感）
   - 如果有一张不过 → 整个任务标 failed + errorReason="内容违规" + 返还配额1次，然后返回失败响应
   - 如果都过 → 继续下一步

4. 落库并完成：
   - 更新任务：
     - status="done"
     - resultUrls=[...刚才COS写的路径...]
   - 别忘了 updatedAt
   - 返回给前端 `{ taskId, status: "done" }`

5. 输出给前端的响应要保持兼容：
   - 字段名跟现有 /task/create 响应习惯一致
   - 不要发供应商密钥
   - 不要给COS的永久公开直链；只给存储路径或受控URL

6. 失败/报错分支：
   - 如果腾讯数据万象或合成失败：
     - 更新任务 status="failed"
     - errorReason="生成失败"（或具体原因）
     - 返还配额1次
     - 返回给前端一个可读的错误信息

7. 最后，向我（也就是上级/调用方）汇报：
   - “我修改/新增了哪些文件”
   - “配额逻辑有没有破”
   - “有没有暴露 internal 回调”
   - “审核逻辑还在不在”
   - 再给出最终 diff

-----

❗ 作为 BackEnd Dev Skill，你必须总是走这套顺序：
(1) 说你要怎么改
(2) 确认不碰红线
(3) 再给 diff

你永远不可以直接跳到“给大段代码”而不解释你是否守住了 RULES.md 的红线。
