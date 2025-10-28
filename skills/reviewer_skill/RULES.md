# RULES: Review 审查规则（上线门槛）

任何违反这些规则的改动，必须 FAIL-BLOCK，不能合并。

---

## 1. 计费 / 配额完整性
- 创建任务仍然需要会员+配额校验。
- `/task/create` 里依然会预扣1次配额，永远不会让 quota_remaining 变负数。
- 失败（failed）仍然会触发配额返还，由主后端负责。
- 前端不会假装加/减配额，也不会展示虚假配额。
- SCF 不会自己改配额或返还配额。

如果有任何跳过扣次、允许游客/非会员跑高成本算力、或不返还失败配额的行为 → FAIL-BLOCK。

（这条与 billing_guard_skill 的判断一致。你必须至少达到 billing_guard_skill 的标准。）

---

## 2. 安全边界没被破
- `/internal/task/update` 仍然是内部接口，带签名/鉴权，不暴露给浏览器调用。
- 供应商 API Key、回调签名 Token、vendorTaskId 等敏感字段**不出现在前端代码**、不出现在公开响应、也不被console.log透给用户。
- COS 的输出结果依然按 `output/{userId}/{taskId}/...` 隔离存储，没有变成公共图床/裸公共CDN。
- 主后端依然不直接吞大文件二进制（大资源流量仍由 SCF Worker 或 COS 事件来处理），防止主后端被耗爆。

如果有"为了方便，直接把回调URL放前端，让前端打 /internal/task/update"这种 → FAIL-BLOCK。

---

## 3. 接口合同稳定
- 对现有公开 API（特别是）
  - `POST /task/create`
  - `GET /task/:taskId`
  - `GET /task/list`
  - `GET /membership/status`
  - `GET /media/sts`
- 字段名和语义必须保持兼容。
  例如：
  - `status` 仍是 "processing" / "done" / "failed"
  - `resultUrls` 是数组
  - `errorReason` 用于失败说明
  - `quota_remaining` / `quota_expireAt` 仍作为会员面板数据来源

不允许：
- 突然改字段叫法（比如把 `status` 改名成 `state`，会炸现有前端）
- 随意删字段（导致旧页面崩）
- 把内部字段（vendorTaskId、供应商内部trace）塞进公开响应

API合同被破坏 → FAIL-BLOCK。

---

## 4. UI / 品牌一致性
- 前端新增/修改的页面必须遵守我们既定视觉系统（高奢时装 AI 工作台风格）：
  - 深色渐变背景（蓝黑→墨绿）
  - 半透明玻璃卡片 (`bg-white/10`, `backdrop-blur-md`, 细边框，圆角 `rounded-2xl`)
  - 冷色发光描边按钮（霓虹青/电蓝勾边，不是传统实心大蓝块）
  - 文案使用轻量高定风格：大标题 `text-white text-3xl font-light`、说明文字 `text-white/60 text-sm`
  - 状态胶囊（pill）来表示会员/处理中/失败等状态，颜色控制在霓虹青/玫红，不要用土黄警告条
  - 任务详情页要呈现"生成中 / 完成 / 失败"的仪表感，而不是裸 JSON dump

如果提交的 UI 回到了传统企业后台（白底+灰边+普通蓝按钮），或者输出风格与我们沉浸式时尚方向冲突，必须至少 PASS-WITH-RISK 并要求视觉整改。

如果直接把安全信息、密钥、内部路径展示在UI上 → FAIL-BLOCK（视为安全泄露）。

---

## 5. 架构职责没被搞乱
- 后端仍然是业务编排 + 计费/配额 + 状态管理。
- SCF Worker 仍然是高耗时/大文件代理执行单元 + 回调汇报，不直接控制配额/计费，不持久化账本。
- 前端仍然只是 UI、提交任务、轮询任务状态，完全依赖后端返回的数据来显示。
- Reviewer 必须确保：没有人试图把这三者混在一起（例如：让前端直接和 RunningHub 对话、让SCF直接改数据库、让后端去直接托管几十MB的视频流上传）。

如果有人试图合并边界（例如"为了简单，前端直接POST RunningHub"）→ FAIL-BLOCK。

---

## 6. 观感与信息披露
- 对用户展示的错误信息，必须是干净、面向业务的，比如：
  - "生成超时，请稍后重试"
  - "图像未通过内容规范审核"
  - "服务暂时不可用"
- 不允许：
  - 暴露具体供应商栈信息（"RunningHub node 74 crashed at step 3"）
  - 暴露内部bucket名、密钥、callback签名、服务器IP、完整堆栈trace
- 如果看到提交里把内部报错原样抛到UI，这就是 FAIL-BLOCK。

---

## 7. 最终上线要求
- 任何"为了测试先放开限制"的代码（去掉会员校验、去掉限速、打开公共CDN、关闭审核）都不应进主分支。
- 如果他们说"这是临时的，只是测试"，你的判断依然是 FAIL-BLOCK，除非这段被明确隔离到本地/dev-only，不会出现在生产构建。

---

总结：
你是最后一道门。
你的回答必须清晰、结构化、可执行，让产品负责人一眼知道这次改动能不能并进主分支和上生产环境。