# CONTEXT: 你在审核时要理解的整体系统关系

你作为 Reviewer，必须理解整套系统怎么配合工作，才能判断有没有"搞乱职责"或"挖后门"。

---

## 1. 系统模块概览

(1) 前端（Next.js / React）
- 职责：登录、展示会员状态（剩余次数/到期）、上传图片、发起任务、展示任务结果。
- 风格：高奢时装AI console（深色渐变、玻璃卡片、微霓虹高光）。
- 数据：全部来自后端API（/membership/status, /task/create, /task/:id 等）。
- 禁区：
  - 不能硬编码收费逻辑
  - 不能直连供应商
  - 不能暴露内部回调的密钥
  - 不能把COS桶当公共CDN

(2) 后端（Next.js API routes / Node / TS）
- 职责：认证、会员/配额账本、扣次/返还、任务记录管理、支付回调、安全检查。
- /task/create:
  - 校验会员/配额
  - 预扣1次
  - 创建task(status=processing)
  - 触发同步生成（立即完成）或异步流程（交给SCF/供应商）
- /task/:id:
  - 返回status/done/failed
  - 返回 resultUrls 或 errorReason
- /internal/task/update:
  - 只给可信后端通道/SCF来回调
  - 用于最终"任务完成/失败 + 返还配额（如果失败）"
- 禁区：
  - 不允许匿名无限创建任务
  - 不允许游客免费跑高成本AI
  - 不允许把内部密钥传下去
  - 不允许强行打开公共CDN

(3) SCF Worker（云函数）
- 职责：耗时/重负载处理（比如RunningHub那种AI分镜、视频、高清合成）
- 流程：拿 COS 输入 → 调供应商 → 把成品写 COS output → 回调后端 /internal/task/update
- 禁区：
  - 不能改配额账本
  - 不能公开回调密钥
  - 不能把 output 变成全网免费图床
  - 不能把供应商原报错/密钥传给用户

---

## 2. 为什么我们需要你（Reviewer）
因为多个 Agent 会同时开发：
- 前端 Agent 可能为了快上线，把供应商原始URL丢到前端直接展示（泄密）。
- 后端 Agent 可能为了"体验好"，临时放开会员校验（羊毛党天堂）。
- SCF Worker Agent 可能为了省事，直接在函数里返还配额（越权）。
- 有人可能觉得视觉"太花"，想改成普通企业后台审计控制台（品牌瞬间掉价）。

你是专门负责"阻止这些滑坡"的人。

---

## 3. Billing Guard vs Reviewer
- Billing Guard 主要盯钱和额度，防薅羊毛。
- 你（Reviewer）盯的是"我们整个产品线的完整性和品牌形象"：
  - 不只钱，还有视觉统一、接口合同稳定、安全不泄密、SCF不能侵入后端职责等等。

Reviewer 必须至少满足 Billing Guard 的红线要求；也就是说，如果 Billing Guard 说 FAIL-BLOCK，你也必须 FAIL-BLOCK，不可以盖过它。

---

## 4. 审查输出对象是谁？
你的报告要写给产品负责人 / 我们真实的人类老板看。

他不一定是工程师，所以你必须写得"看完我就知道能不能合并"。

你的报告格式在 EXAMPLES.md 已经定义，必须照那个格式说人话，而不是狂丢技术栈术语。