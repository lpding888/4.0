# EXAMPLES: 你（Product Planner）应该怎么输出一项新需求

这是模板。以后每个新功能你都要用这个格式给出，一模一样的结构。

-------------------------------------------------
【功能名称】
"促销海报生成（Promo Poster）"

【这个功能是干嘛的？（业务价值）】
商家上传一张商品图（衣服/鞋子），输入折后价/促销文案，系统自动生成一张高转化促销海报图，可直接用于朋友圈、直播间封面、详情页banner。
目标是帮助商家更快做活动素材，省掉美工。

【目标用户是谁？】
- 已付费会员（有配额的商家运营）
- 使用场景：准备促销活动 / 上新、急需一张宣传图的人

【入口放哪？（前端指令）】
- 出现在工作台主页新的功能卡（和"服装清理增强""AI模特12分镜"同一排）
- 卡片视觉必须遵守我们的高奢系：玻璃卡+霓虹边按钮，不允许默认灰白企业风
- 点击后进入一个新表单页 `/promo-poster/new`
  - 这个表单页是一个半透明面板浮在深色渐变背景上
  - 用户会上传商品图、填写促销价、选择主题（清仓 / 新品 / 限时优惠）

【这是同步任务还是异步任务？谁负责算？】
- 类型：同步任务
- 执行路径：
  - 前端拿 STS，直传图到 COS `input/{userId}/{taskId}/original.jpg`
  - 前端调用 `POST /task/create` with `type="promo_poster"`
  - 后端会直接调用供应商（例如合成海报的服务，可能是腾讯图像/或我们后端里已有模版引擎）
  - 几秒内产图
  - 后端立刻把成品图写入 COS `output/{userId}/{taskId}/poster_main.jpg`
  - 直接返回 status=done + resultUrls
  - 前端跳到 `/task/[taskId]` 展示结果
- 因为它是同步生成，所以正常情况不需要 SCF Worker，不需要轮询，不是长耗时任务。

【计费 / 配额策略（必须写）】
- 用户点击"生成海报" -> 就是创建一个任务 -> 就要扣1次配额（预扣）
- 如果生成成功：不返还
- 如果生成失败（比如内容违规、图太糊导致无法搞）：后端会把任务标 failed，并返还1次配额
- 使用门槛：必须是会员且 quota_remaining>0 且在有效期内
- 非会员点击功能卡时，前端应该弹出"开通会员"引导，而不是放他们进去表单
- 没有任何"游客免费试用"模式

【接口需求（后端指令，交给 Backend Dev Skill）】
1. `POST /task/create`
   - 新支持一个 `type = "promo_poster"`
   - 需要字段：
     - `inputImageUrl` : COS上用户刚传的原图路径
     - `params`:
       - `price` (string/number, 例如 "199")
       - `theme` (string, 例如 "clearance" / "new_arrival" / "flash_sale")
       - `slogan` (string, 促销文案，可选)
   - 行为：
     - 校验会员与配额（预扣1次，不能小于0）
     - 同步生成最终促销海报图
     - 写结果到 `output/{userId}/{taskId}/poster_main.jpg`
     - 返回：
       ```json
       {
         "taskId": "abc123",
         "status": "done",
         "resultUrls": ["cos://output/user123/abc123/poster_main.jpg"]
       }
       ```
     - 如果失败：
       - 标记任务为 failed
       - 返还配额
       - 返回：
       ```json
       {
         "taskId": "abc123",
         "status": "failed",
         "errorReason": "生成失败，请更换图片后重试"
       }
       ```

2. `GET /task/:taskId`
   - 已有，不需要新字段
   - 仍然返回 status / resultUrls / errorReason
   - 我们不要求修改接口合同（不能改字段名）

后端**禁止**：
- 禁止跳过会员校验
- 禁止跳过预扣配额
- 禁止把供应商apiKey暴露到响应里

【前端需求（交给 Frontend Dev Skill）】
1. 工作台新增卡片：
   - 卡片样式必须是我司高奢风（深色玻璃+霓虹高光按钮）
   - 文案结构示例：
     - 标题："促销海报生成"
     - 描述："一键生成商用活动海报，直接拿去朋友圈/直播间"
     - CTA按钮文字："立即生成"
   - 点击逻辑：
     - 如果 `/membership/status` 返回 isMember=false 或 quota_remaining<=0，则弹出"开通会员/购买配额"对话框，不允许进入表单
     - 否则跳到 `/promo-poster/new`

2. `/promo-poster/new` 表单页：
   - 显示在深色渐变背景上，主体内容是半透明玻璃卡片
   - 字段：
     - 上传商品图 (必须先调 `/media/sts` 获取STS，再直传COS)
     - 输入促销价
     - 选择主题（下拉：清仓/新品/限时）
     - 可选文案
   - 提交时：POST `/task/create` with type="promo_poster"
   - 如果返回 status=done -> 直接跳转 `/task/[taskId]`
   - 如果返回 status=failed -> toast红色胶囊风格提示错误信息

3. `/task/[taskId]` 详情页：
   - 如果 `status=done`：展示海报图（单张 resultUrls[0]）
   - 如果 `status=failed`：展示玫红 pill + errorReason
   - 不需要轮询（同步任务），但要能渲染这个类型的任务

前端**禁止**：
- 不允许在浏览器里调用供应商API
- 不允许给用户看内部vendorTaskId或签名
- 不允许假装加减配额本地显示

【SCF Worker 需求】
- 对这个功能（promo_poster）：暂时不需要SCF Worker，因为是同步型任务。
- 但是请 SCF Worker 准备一个 future plan：将来如果我们要支持"促销海报批量多模板生成（比如一次生成8种海报）"，那可能会变成长耗时任务，就会需要异步+轮询+回调+审核。现在先不做。

【内容审核 / 合规要求】
- 海报图必须在输出前/或后立即通过内容审核（涉黄/敏感）
- 如果审核不过：任务直接标 failed，errorReason = "内容不符合规范"
- 失败要返还配额（后端做）
- 前端展示这个errorReason，不展示具体违规细节

【成功标准（验收条件）】
上线后我们判断功能"算完成"的标准：
1. 会员账号登录 → 工作台看到"促销海报生成"卡片
2. 用户上传图片、填价、点生成 → 能拿到一张最终海报图
3. `/task/[taskId]` 能显示这张海报
4. quota_remaining 正常扣1
5. 如果我们故意上传一张很糟的图导致生成失败，前端会提示错误，任务详情页status=failed，且quota_remaining被返还

如果以上 1~5 都成立，这个功能算交付完毕，可以进生产审核（Reviewer Skill）。

-------------------------------------------------
【交付给谁】
- Backend Dev Skill：请实现 type="promo_poster" 的创建逻辑、配额校验、扣/返配额、生成结果、返回结构
- Frontend Dev Skill：请实现工作台卡片、表单页、详情页展示，使用我们的高奢时装AI控制台视觉体系（深色渐变+玻璃卡+霓虹描边按钮）
- Billing Guard Skill：请审查这个功能的扣费/返费是否遵守现有模型，确认没有"非会员免费跑""不扣次数"
- SCF Worker Skill：记录为"当前无需SCF（同步任务）"。但请评估未来批量生成/视频模板是否需要你负责
- Reviewer Skill：在合并前最终判断这一整套 是否破坏接口合同 / 视觉一致性 / 安全边界 / 计费模式

-------------------------------------------------

总结：
你的输出必须像这样，有：
- 功能是什么
- 给谁用
- 放哪儿
- 同步/异步
- 后端要加什么接口/参数
- 前端页面怎么接
- 是否需要SCF
- 配额怎么扣/返
- 合规审核怎么过
- 成功标准是什么
- 派发给哪些技能

如果你没给出这些维度，其他 Agent 不允许实现，Reviewer Skill 必须 FAIL-BLOCK。