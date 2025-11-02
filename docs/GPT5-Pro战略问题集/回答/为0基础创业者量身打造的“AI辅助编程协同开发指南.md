下面是一份**为0基础创业者量身打造的“AI辅助编程协同开发指南”**。
它围绕你的实际项目（Next.js 14 + React 18 + Express.js + MySQL + Redis，目标延伸到 React Native App），以**AI-First**为核心原则，给出从选工具、学路径、到实战开发、避坑、案例、进阶的**系统化、可执行方案**。你可以把它当作“日常工作手册 + 训练营课程大纲 + 现场实战脚本”。

> **为什么用AI-First？**
> 你的“核心优势”就是用 Claude Code、Cursor、GPT‑5 Pro、Copilot 等把**传统3–5年经验**压缩到**3–6个月**。因此我们不走“先学再做”的传统路线，而是**在做中学**：一切围绕\*\*如何把AI当成你的“外包全栈团队”\*\*来组织工作流、提示词、代码审查与上线防护。

---

## 目录（建议收藏与反复使用）

1. 学习路线图（第1周→第3个月）
2. AI工具使用手册（Claude Code / Cursor / GPT‑5 Pro / Copilot / 其他）
3. 实战开发指南（Web 日常开发、App 从0到上架、代码复用）
4. 常见问题解决方案（报错→诊断→修复，性能优化）
5. 避坑指南（0基础常犯20个错误 + 不崩溃策略 + 质量保障）
6. 实战案例（新增页面、修复生产Bug、做CMS、从0做RN App）
7. 进阶路线（3个月/6个月/1年成长路线）

> 文中少量对第三方工具的事实性说明，引用了官方页面：
>
> * **Claude Code**：官方文档与功能概述。([Claude Docs][1])
> * **Cursor**：功能与定价页面。([Cursor][2])
> * **GitHub Copilot**：官方定价与版本说明。([GitHub Docs][3])
> * **v0（Vercel）**：AI 生成 React/Tailwind/Shadcn UI。([Vercel][4])
> * **Expo / React Native**：入门与“Launch to Stores”官方说明。([Expo Documentation][5])
> * **GitHub 保护分支**：官方操作与建议。([GitHub Docs][6])
> * **Knex.js**：官方文档。([Knex.js][7])

---

# 0. 总原则（AI‑First 十诫）

1. **问题→AI→代码→运行→再问AI**：不“先学完再干”，而是“边干边学”。
2. **上下文即生产力**：给 AI 喂**文件片段 + 报错 + 目录结构 + 需求**，产出质量显著提升。
3. **小步快跑**：每次让 AI 产出**一小段改动**，立刻运行与回归。
4. **回滚安全网**：一切在**分支上**改，主分支受保护；每一步都可回退（后文有脚本）。([GitHub Docs][6])
5. **让AI解释其代码**：不理解不合并；要求“逐段解释+边界条件+测试点”。
6. **生产“可观察”**：日志、错误上报、健康检查先于功能复杂度。
7. **测试优先于重构**：先写（或请AI写）最小可运行测试，再改结构。
8. **成本可控**：先订**核心工具**（Cursor/Copilot/Claude Code 按需），GPT‑5 Pro在架构阶段开。
9. **架构=清晰边界**：Web UI / API / 数据访问 / 队列 / 模型调用分清职责。
10. **文档即资产**：每次决策、提示词与踩坑记录到 `docs/`，下次复用提示词直接提速。

---

# 1. 学习路线图（0 → 3 个月）

> 每日 4–6 小时；**每周有交付物（可运行/可点击/可演示）**；每周五做复盘（10–30分钟）。

## 第1周：环境搭建与“敢改代码”

**目标**：能在本地跑起来、能改一个小功能、能提交到远程仓库。
**里程碑**：`npm run dev` 前后端能启动；改了首页标题或按钮并成功提交 Git。

**Day 1–2：环境搭建**

* 安装：Node.js LTS、Git、VS Code（或直接用 **Cursor** 作为IDE）。
* 订阅/安装工具：Cursor（IDE内置AI）、GitHub Copilot（补全）、Claude Code（命令行智能改库，可选）、GPT‑5 Pro（当周不急开）。([Cursor][8])
* 克隆你的仓库，配置 `.env`，启动：

  ```bash
  # 前端
  cd frontend && npm i && npm run dev
  # 后端
  cd backend && npm i && npm run dev
  ```
* 在 `docs/SETUP.md` 记录所有步骤（方便新设备/新同事复现）。

**Day 3–4：项目全景认知**

* 用 **Claude Code** 或 **Cursor** 的“Repo Explain/Ask”功能生成“**项目地图**”：模块、目录、关键数据流、请求链（注册→任务提交→Pipeline→结果）。

  * 典型提示词（放到 `docs/prompts/repo-map.md`）：

    > 背景：这是一个 Next.js + Express + MySQL + Redis 项目。
    > 需求：帮我输出项目全景图（目录树+核心模块+调用链），并标注：注册→登录→提交AI任务→pipeline→状态返回的端到端流程。请指出与 Redis 的交互点与 MySQL 的主要表。输出 Markdown。
* 把 AI 生成的结构图贴到 `docs/architecture/overview.md`。

**Day 5–7：第一次改动（建立信心）**

* 任务：修改首页标题或新增一个按钮（点击弹出版本号）。
* 工作流：

  1. **新建分支** `feat/first-change`；
  2. 在 Cursor 中用“/fix”或“/edit”选择相关文件局部修改；
  3. 本地跑通→自测→提交 PR；
  4. 合并前请 AI 做**代码审查清单**（见第5章）。
* 成果：截图首页变化 + 合并记录到 `docs/weekly/2025-Week1.md`。

---

## 第2–4周：核心技能（前端→后端→调试）

**Week 2：前端入门（Next.js App Router + React 18）**

* 学会：组件（函数组件/props）、状态（`useState/useEffect`）、路由（App Router）、数据获取（`fetch`/`server actions`）。
* 小任务（每天1个）：改配色、替换文案、抽出组件、做一个表单（登录或搜索）。
* AI协作：

  * 提供**目标文件路径**+**期望UI**+**接口约定**。
  * 要求 AI：给**最小改动补丁**（diff）、并解释每处风险（表单校验/错误态/加载态）。

**Week 3：后端入门（Express + Knex + MySQL + Redis）**

* 学会：路由、控制器、服务层、Knex 查询、事务、简单缓存（Redis）。
* 小任务：新增 `GET /api/users/me`、`GET /api/orders`；为热点接口加 `Redis` 缓存。
* AI协作：

  * 让 AI 基于 **Knex 官方示例** 写**迁移 + 种子 + 查询**（见第6章案例含代码）。([Knex.js][7])

**Week 4：调试与问题解决**

* 学会：看前后端报错、断点调试（VS Code/Cursor）、Chrome DevTools Network、后端日志与 `console.log`/`pino`。
* 模板：**“五步排障”**（见第4章）：复现→定位→最小化→验证→回归。
* 成果：写一篇 `docs/diagnostics/first-bugfix.md`，记录一次真实故障的来龙去脉。

---

## 第2个月：独立做完整功能（端到端）

**目标**：能从 **PRD → 数据库 → API → 前端页面 → 自测 → 部署** 独立打通。
**里程碑**：完成一个“公告管理”或“订单管理”完整功能（后面给出模板与代码骨架）。

**周度安排**

* Week 5：PRD → 数据库建模（迁移/种子）→ 后端API草稿
* Week 6：前端页面（列表/详情/表单）→ 接口联调
* Week 7：补齐边界与错误态（空列表、网络失败、权限错误）→ 写最小测试
* Week 8：小型性能优化（分页、索引、缓存）→ 部署到测试环境

---

## 第3个月：理解与优化架构 + 启动 App 线

**目标**：理解 Pipeline 引擎/Provider 体系；对关键路径做可观测与小重构；启动 React Native App 骨架并完成两三个关键页面。
**里程碑**：

* Web：完成一次“重构+可观测”任务（如：任务状态流改为**SSE/WS + 轮询降级**）。
* App：用 **Expo** 起项目、连通现有后端、完成登录+“我的衣柜”列表+拍照页（后文有代码）。([Expo Documentation][5])

---

# 2. AI 工具使用手册（定位、最佳场景、上手清单、提示词）

> 你不是在“学习代码”，而是在“调度一个AI工程团队”。不同工具是不同角色。

## 2.1 Claude Code（“全栈工程师 + 审查员 + 代码改库代理”）

* **定位**：命令行/网页端的\*\*“智能改库代理”**，适合**多文件协同修改、重构、创建迁移、写测试\*\*，也能做**仓库全景分析**与**复杂问题诊断**。([Claude Docs][1])
* **新增（2025）**：Claude Code on the Web（无需终端，连 GitHub 仓库，在线并行执行任务）。([Anthropic][9])
* **最佳场景**：

  * 第一次接手不熟悉的仓库 → 生成“项目地图/调用链”。
  * 复杂改动：跨前后端、多文件重构、批量接口对齐、写迁移与单测。
  * 安全/性能审查：请它输出“问题清单 + 优先级 + 修复补丁”。
* **不擅长/注意**：需要给清晰目标与边界；**一次一小步**；让它产出 **diff** / **patch** 以便你审阅与回滚。
* **上手清单**：

  1. 连接仓库（或在本地用 CLI 对当前目录操作）；
  2. “Explain this repo” 生成全景图放 `docs/architecture/overview.md`；
  3. 以“**小任务**”驱动：每次限定修改范围+完成标准（Definition of Done）；
  4. 强制它**生成测试**与**迁移回滚**。
* **高质量提示词模板（示例）**

  ```
  背景：Next.js 14 + Express + MySQL + Redis。这里是目录树（截取相关部分）：
  <粘贴目录片段或文件>
  需求：在 frontend/src/app/orders 下新增页面与组件，后端新增 /api/orders 路由，
        使用 Knex 查询 orders 表。支持分页与状态筛选。
  约束：TypeScript + App Router；Tailwind；Knex；不要引入 ORM；保留现有中间件。
  输出：1）所有改动的文件 diff；2）数据库迁移与回滚；3）最小的单测样例；
        4）逐段解释关键逻辑与边界；5）验证步骤与本地运行命令。
  ```

## 2.2 Cursor（“AI‑first IDE：日常开发、补全、快速迭代”）

* **定位**：在一个熟悉的编辑器里把“**手动编码→半自动→代理执行**”串起来；提供**Chat/Agent/Tab 补全**、代码重写、PR 评论与 Bug 修复回路。([Cursor][2])
* **最佳场景**：

  * 日常小改、粘连少的任务、快速实验；
  * 与 Copilot 联动：局部补全 + 局部解释；
  * 结合“**背景上下文**”（选中文件/错误日志）做“就地修复”。
* **成本**：有免费与多档 Pro/Pro+/Ultra，个人入门常用 Pro 或 Pro+；以官网当前定价为准。([Cursor][8])
* **提示词示例**

  ```
  我在这个 diff 上看到 TS 报错 TS2322。请仅对这两个文件做最小修改修复，
  给出原因 + 风险 + 测试步骤，不要重写其他模块。
  ```

## 2.3 GitHub Copilot（“低摩擦补全 + 上下文问答”）

* **定位**：**行级/块级补全**、基础解释、样板代码快速产出；与 Cursor 同用效果更佳。
* **最佳场景**：写样板、表单校验、接口封装、状态管理模板、测试样例雏形。
* **成本提示**：Copilot Pro 个人价 **\$10/月**，另有 Pro+ 与免费版配额。以官方为准。([GitHub Docs][3])

## 2.4 GPT‑5 Pro / o1‑pro（“架构师 + 技术顾问”）

* **定位**：做**技术选型、架构权衡、拆解复杂需求、跨模块权衡与路线图**；作为“第二意见”审查 Claude Code 的方案与 PRD。
* **使用要点**：

  * 给它**问题背景**、**现状**、**约束**、**目标**、**风险**、**备选方案**；
  * 要求输出\*\*“对比矩阵 + 决策建议 + 风险/监控点 + 回滚策略”\*\*；
  * 产出结果交给 Claude Code 生成代码，再回到 GPT‑5 Pro 复核。

## 2.5 其他工具（可择优纳入）

* **v0.dev（Vercel）**：用自然语言生成**前端UI（React + Tailwind + Shadcn）**，适合先出“90%雏形”，再粘到你的项目里微调。([Vercel][4])
* **Bolt.new（StackBlitz）**：浏览器里**从提示到可运行全栈**，零本地配置，快速原型/验证想法。
* **Replit AI**：在线 IDE + 代理式构建，适合“边问边跑”与一键部署；新人做练习项目很方便。

> 注：上述第三方功能/定价会变化，最终以官方页面为准（本文相应处已给出引用）。

---

## 2.6 组合使用（推荐工作流）

* **新功能开发**：GPT‑5 Pro（方案与数据库/接口清单）→ Claude Code（多文件改库 + 迁移 + 单测）→ Cursor（本地迭代与联调）→ Copilot（补全/样板）。
* **日常迭代**：Cursor（就地修） + Copilot（补全） + Claude Code（偶发大改/重构）。
* **代码审查**：先 Claude Code 出问题清单与补丁建议，再让 GPT‑5 Pro 做二次把关（风险+回滚）。
* **调试修复**：Cursor（现场抓报错与最小修复）→ Claude Code（系统性复盘/补齐测试）。

---

## 2.7 成本预算（按需启用）

* 入门“**最低可用组合**”：**Cursor Pro** + **Copilot Pro**（\$20 + \$10）；架构阶段或大功能周期再开 **GPT‑5 Pro**；复杂改库期短开 **Claude Code**。
* 你提供的 \~\$250/月是“全开”估算；日常可通过**阶段性订阅**把成本打到一半以下（例如只保留 Cursor+Copilot，Claude Code 与 GPT‑5 Pro 按月临时开/关）。
* 不用在“工具覆盖率”上纠结，**覆盖你的关键工作流**即可：架构（GPT‑5 Pro）、改库（Claude Code）、迭代（Cursor+Copilot）。

---

# 3. 实战开发指南（Web、App、复用）

## 3.1 Web 项目日常开发流程（AI‑First）

**固定仪式（每天开工 5–10 分钟）**

1. **同步 main 分支**，新建 `feat/<日期>-<功能>` 分支；
2. 在 `docs/dailies/<日期>.md` 写下**今日目标**与**Definition of Done**；
3. 用 Claude Code 生成“任务拆解表”（接口/页面/数据/测试/验收）。
4. 把拆解转为 GitHub Issues/Tasks。

**单次迭代（每 1–3 小时一个循环）**

* **A. 让AI产出最小改动**：明确“输入文件/输出形态”，要求**diff**与逐段解释。
* **B. 本地运行**：`npm run dev` + 手测 + 加必要的 `console.log`/日志（后端用 `pino`）。
* **C. 失败就降维**：缩小改动范围 → 提供更具体上下文 → 输出更小的补丁。
* **D. 写最小测试**（让 AI 写）：列表渲染/接口200/空态/错误态。
* **E. 提交 PR**：请 Claude Code 做审查→修订→合并。
* **F. 每日小结**：记录“有效提示词 + 踩坑”。

**保护主分支（避免“搞崩溃”）**

* 开启 GitHub **保护分支**：要求 PR 审查/状态检查通过才可合并，禁止直接推 main。([GitHub Docs][6])

---

## 3.2 App 从 0 到上架（React Native / Expo 推荐）

> **为什么 RN + Expo**：与你的 React 技术栈一致，能最大化复用业务逻辑；Expo 提供从开发、构建到上架的**一条龙工具链**，对 0 基础极其友好。([Expo Documentation][5])

**步骤总览**

1. **起项目**：`npx create-expo-app@latest` → 选择 TypeScript；跑起来。([Expo Documentation][5])
2. **安装导航**：React Navigation（Stack+Tabs）；
3. **状态管理**：Zustand 或 Redux Toolkit（二选一，Zustand更轻）；
4. **API 客户端与类型**：封装 `apiClient`（基于 `fetch`），用 Zod 校验；
5. **安全存储**：登录 token 存 `expo-secure-store`；
6. **相机/相册**：Expo Camera/ImagePicker；
7. **推送**：先用 Expo Notifications（后期可换第三方）；
8. **构建与分发**：EAS Build + Submit；**官方有“Launch to Stores”引导**。([Expo Documentation][5])

> 后文第6章给出**完整 RN 最小骨架**（登录 + 衣柜列表 + 拍照上传）。

---

## 3.3 Web→App 复用策略（Monorepo）

**推荐 Monorepo 结构（turborepo 或 pnpm workspace）**

```
/apps
  /web        # Next.js 14
  /api        # Express.js
  /app        # React Native (Expo)
packages/
  /shared     # 业务逻辑、类型（zod schema / DTO）、utils、API SDK
  /ui-web     # 只给 web 的组件
  /ui-native  # 只给 RN 的组件
```

* **可复用**：业务逻辑（API 封装、数据处理）、类型定义（TypeScript）、状态模型、工具函数。
* **不可复用**：UI层（DOM vs 原生组件）、路由（App Router vs React Navigation）、样式（CSS/Tailwind vs RN StyleSheet/nativewind）。
* **落地做法**：

  * `packages/shared/src/api/index.ts` 暴露 `getOrders()/createOrder()` 等；
  * Web 与 App 各自引入并实现在地 UI；
  * 用 `tsconfig` 的 `paths` + `pnpm` workspace 链接。

---

# 4. 常见问题解决方案（报错→诊断→优化）

## 4.1 报错怎么办？“五步排障法”

1. **复现**：写下重现步骤 + 输入/输出 + 截图/日志；
2. **定位**：根据报错堆栈锁定文件/行；用 Cursor 的“/explain”先解释再改；
3. **最小化**：临时注释/隔离，引入假数据确认范围；
4. **验证**：加日志/断点；前端看 Network、后端看路由与SQL；
5. **回归测试**：写一个微型单测或 E2E 脚本，确保修复不会回退。

> **AI 提示词模版（Bug 诊断）**
>
> ```
> 背景：我在 Next.js 14 App Router 的 orders 页面请求 /api/orders
> 报错：TypeError: Cannot read properties of undefined (reading 'map')
> 附件：page.tsx 关键代码片段 + 接口返回示例
> 需求：请分析可能原因，给出最小修复补丁（diff），并说明边界与自测步骤。
> ```

## 4.2 功能不符合预期？

* **描述“期望 vs 实际”**，附上交互录屏/截图、API 请求与响应；
* 让 AI 给出：1) **可能原因排序**；2) **逐项验证办法**；3) **最小修改**；4) **回归测试用例**（含空态/错误态）。

## 4.3 性能慢怎么办？

* **数据库**：加索引（WHERE/ORDER BY字段）、分页（`limit/offset` 或 游标）、N+1 查询合并；
* **缓存**：热点接口加 Redis 缓存（TTL + 失效策略）；
* **前端**：列表虚拟化、懒加载、骨架屏；
* **AI 用法**：

  * 让 AI 输出**慢查询排查脚本**（Knex/SQL EXPLAIN）；
  * 要求**缓存读写策略**与**一致性风险**说明；
  * 请它生成**性能基准脚本**（k6/Artillery）和结果解读。

---

# 5. 避坑指南（0基础常犯20错 + 不崩溃 + 质量）

## 5.1 0基础最常犯的20个错误（与对策）

1. **盲目复制AI输出** → 先让 AI **逐段解释**与**测试用例**，再运行。
2. **不做版本控制** → 每个任务一分支；主分支受保护。([GitHub Docs][6])
3. **一次改太多** → 限定范围与文件；要求 AI 给最小 diff。
4. **不看报错** → 先读堆栈与上下文，再问 AI。
5. **不写文档** → `docs/` 记录“决策/提示词/踩坑”。
6. **依赖未锁定** → 使用 `package-lock.json`/`pnpm-lock.yaml`；版本范围尽量固定。
7. **把密钥写死** → `.env` + 环境注入；绝不进仓库。
8. **无日志与监控** → 后端 `pino`、前端错误上报（Sentry/自建），接口耗时统计。
9. **无测试** → 关键路径至少烟雾测试；AI 先给脚手架。
10. **直接动生产** → 先本地，后测试环境，最后生产；有备份与回滚。
11. **数据库不做迁移** → 用 Knex 迁移 + 回滚脚本。([Knex.js][7])
12. **越权缺陷** → 路由加鉴权中间件；后端再做权限校验。
13. **JWT 乱放** → Web 优先 HttpOnly Cookie；App 用 SecureStore。
14. **XSS/CSRF** → 编解码、白名单、同源策略、CSRF Token。
15. **文件/图片直传不控** → 大文件走对象存储直传（STS 签名），服务端验证回调。
16. **任务状态只靠轮询** → 增加 WS/SSE + 轮询降级。
17. **错误提示写死中文** → 统一 i18n 文件，前后端同 key。
18. **开发/测试/生产混杂** → `.env.development/.env.production` 分离。
19. **不做数据备份** → MySQL 定时备份，Redis 关键集合快照。
20. **不设分支策略** → 合并前 CI 必须绿；最少 1 次审查。([GitHub Docs][6])

## 5.2 不把项目搞崩溃（三道防线）

1. **Git 保护**：启用保护分支（要求PR+状态检查）；禁止直接push `main`。([GitHub Docs][6])
2. **数据库保护**：所有结构更改通过 Knex 迁移 + 回滚脚本；先跑测试环境。([Knex.js][7])
3. **灰度与回滚**：Web 用环境变量切换新功能；后端通过**特性开关**与**版本化 API**。

## 5.3 质量保障（最小清单）

* PR 必带：**变更说明 + 风险点 + 自测步骤 + 截图/录屏 + 回滚方案**。
* 安全基线：**输入校验（Zod）**、**SQL参数化（Knex）**、**日志和掩码**、**限流**、**CORS 配置**。
* 可观测：**请求ID**、**关键查询耗时**、**错误分级**（4xx/5xx）。

---

# 6. 实战案例（含代码）

> 说明：以下代码均为**可直接粘贴的最小骨架**，并附带“AI提示词模板”。
> 你可以把“提示词+代码”直接塞给 Claude Code/Cursor，让它在你的仓库结构里自动落地到正确路径。

---

## 案例1：添加“我的订单”页面（Web）

**目标**：新增 `/orders` 页面（App Router），展示当前用户订单：订单号、金额、状态、创建时间；后端新增 `GET /api/orders/me`。

### 6.1.1 数据库（Knex 迁移）

`backend/migrations/20251030_create_orders_table.js`

```js
/** @type {import('knex').Knex.Migration} */
exports.up = async function (knex) {
  await knex.schema.createTable('orders', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').notNullable().index();
    t.decimal('total_amount', 10, 2).notNullable().defaultTo(0);
    t.enum('status', ['pending', 'paid', 'processing', 'completed', 'cancelled']).notNullable().index();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw('CREATE INDEX orders_user_status_idx ON orders (user_id, status)');
};
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('orders');
};
```

> 让 AI 同步生成**种子数据**与**简单索引建议**。([Knex.js][7])

### 6.1.2 后端服务与路由（Express + Knex）

`backend/src/db/knex.js`

```js
const knex = require('knex');
const config = require('../../knexfile'); // 你的 knex 配置
const env = process.env.NODE_ENV || 'development';
module.exports = knex(config[env]);
```

`backend/src/middleware/auth.js`

```js
const jwt = require('jsonwebtoken');
module.exports = function auth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
```

`backend/src/services/order.service.js`

```js
const db = require('../db/knex');

async function listUserOrders(userId, { page = 1, pageSize = 20, status } = {}) {
  const q = db('orders').where({ user_id: userId }).orderBy('created_at', 'desc');
  if (status) q.andWhere({ status });
  const items = await q.clone().limit(pageSize).offset((page - 1) * pageSize);
  const [{ count }] = await q.clone().clearSelect().count({ count: '*' });
  return { items, total: Number(count), page, pageSize };
}

module.exports = { listUserOrders };
```

`backend/src/routes/orders.js`

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listUserOrders } = require('../services/order.service');

router.get('/me', auth, async (req, res) => {
  const { page = '1', pageSize = '20', status } = req.query;
  try {
    const data = await listUserOrders(req.user.id, {
      page: Number(page), pageSize: Number(pageSize), status
    });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

module.exports = router;
```

在主应用中挂载：

```js
// backend/src/app.js
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/orders', require('./routes/orders'));
module.exports = app;
```

### 6.1.3 Next.js API 代理（可选，便于在 Web 用 Cookie 鉴权）

`frontend/src/app/api/orders/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = req.cookies.get('token')?.value ?? '';
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const url = `${backend}/api/orders/me?${searchParams.toString()}`;

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
```

### 6.1.4 前端页面与组件（App Router）

`frontend/src/app/orders/page.tsx`

```tsx
// 使用服务器组件请求本域 /api/orders，避免在客户端暴露token
import Link from 'next/link';

type Order = {
  id: number;
  total_amount: string;
  status: 'pending'|'paid'|'processing'|'completed'|'cancelled';
  created_at: string;
};

async function fetchOrders(): Promise<{items: Order[]; total: number; page: number; pageSize: number;}> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/orders`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json();
}

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const data = await fetchOrders();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">我的订单</h1>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">订单号</th>
              <th className="px-3 py-2 text-left">金额</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(o => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2"><Link href={`/orders/${o.id}`}>#{o.id}</Link></td>
                <td className="px-3 py-2">￥{o.total_amount}</td>
                <td className="px-3 py-2">{o.status}</td>
                <td className="px-3 py-2">{new Date(o.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length === 0 && (<p className="text-gray-500 mt-4">暂无订单</p>)}
    </div>
  );
}
```

> **提示词模板（交给 Claude Code 一键落地）**
>
> ```
> 这是我的项目。请在上述路径新增订单列表功能，按代码骨架实现：
> 1) Knex迁移（orders表）；2) Express路由 GET /api/orders/me；
> 3) Next.js API 路由 /api/orders 代理；4) /app/orders/page.tsx 页面。
> 要求：TypeScript前端，Node.js后端，返回分页。输出所有改动的diff，并附带
> 自测步骤：如何插入种子数据、如何设置token、如何本地访问演示。
> ```

---

## 案例2：修复生产 Bug —— “任务卡住在 processing，但实际上已完成”

**常见根因**

* WebSocket/SSE 没有正确推送状态；
* 前端只在页面初次加载拉取一次，无订阅或轮询降级。

**修复策略**：

1. 在后端新增 **SSE**（或 WebSocket）事件流 `/api/tasks/:id/stream`；任务状态变更时 `event: status` 推送；
2. 前端使用 `EventSource` 订阅，**失败自动降级**为定时轮询；
3. 首屏加载也做一次 `GET /api/tasks/:id`，保证刷新时也能拿到状态。

**后端（SSE）** `backend/src/routes/tasks.js`

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getTask, subscribeTask } = require('../services/task.service');

// 事件流
router.get('/:id/stream', auth, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const taskId = req.params.id;

  const unsubscribe = subscribeTask(taskId, (status) => {
    res.write(`event: status\n`);
    res.write(`data: ${JSON.stringify({ status, at: Date.now() })}\n\n`);
  });

  req.on('close', () => unsubscribe && unsubscribe());
});

// 普通查询
router.get('/:id', auth, async (req, res) => {
  const task = await getTask(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ message: 'Not found' });
  res.json(task);
});

module.exports = router;
```

> `subscribeTask` 可以用 Redis Pub/Sub、BullMQ 事件或内存事件发射器。

**前端（订阅 + 降级轮询）** `frontend/src/app/workspace/TaskStatus.tsx`

```tsx
'use client';
import { useEffect, useState } from 'react';

export default function TaskStatus({ taskId }: { taskId: string }) {
  const [status, setStatus] = useState<string>('processing');
  const [error, setError] = useState<string | null>(null);

  // 首屏获取
  useEffect(() => {
    fetch(`/api/tasks/${taskId}`).then(r => r.json()).then(d => setStatus(d.status));
  }, [taskId]);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: NodeJS.Timeout | null = null;

    function startPolling() {
      timer = setInterval(async () => {
        try {
          const r = await fetch(`/api/tasks/${taskId}`, { cache: 'no-store' });
          const d = await r.json();
          setStatus(d.status);
        } catch (e) { /* 忽略 */ }
      }, 5000);
    }

    try {
      es = new EventSource(`/api/tasks/${taskId}/stream`);
      es.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.status) setStatus(data.status);
      };
      es.addEventListener('status', (ev) => {
        const data = JSON.parse((ev as MessageEvent).data);
        if (data.status) setStatus(data.status);
      });
      es.onerror = () => {
        es?.close();
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      es?.close();
      if (timer) clearInterval(timer);
    };
  }, [taskId]);

  return <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700">
    {status}
  </span>;
}
```

> **提示词模板**
>
> ```
> 症状：任务完成但前端一直显示 processing。
> 我已在 tasks 路由中添加 SSE，如代码所示。请检查是否有遗漏，
> 并给出后端事件触发点示例（当任务表状态更新时如何发布），
> 以及前端降级轮询的测试步骤。
> ```

---

## 案例3：设计并开发一个轻量 CMS（公告/轮播/功能卡片）

**架构设计（最小可用）**

* 表结构：`announcements(id, title, content, visible, created_at)`、`banners(id, image_url, link, sort_order, visible)`、`feature_cards(id, title, desc, icon, visible, sort_order)`
* API：

  * `GET /api/cms/announcements`（分页/visible过滤）、`POST/PUT/DELETE`（权限）
  * 同理 `banners` / `feature-cards`
* 前端页面：`/admin/cms` 下 3 个子页（列表+编辑表单）；
* 鉴权：管理员角色；
* 可观测：操作日志、错误上报。

> **AI 工作流**
>
> 1. 让 GPT‑5 Pro 产出**数据库/接口/页面**清单与**权限模型**；
> 2. 把清单给 Claude Code：**生成迁移+服务+路由+前端页面骨架 + 最小测试**；
> 3. 用 Cursor 局部迭代与联调；
> 4. Copilot 负责“样板/表格/表单补全”。

---

## 案例4：从0开发一个 React Native App（Expo）

**目录（最小骨架）**

```
/app.json
/App.tsx
/src
  /navigation/index.tsx
  /screens/Login.tsx
  /screens/Wardrobe.tsx
  /screens/Capture.tsx
  /state/auth.ts
  /api/client.ts
  /components/Button.tsx
```

**API 客户端（Zod 校验 + 错误处理）** `src/api/client.ts`

```ts
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const ApiError = z.object({ message: z.string().optional() });
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync('token');
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) }
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(ApiError.safeParse(data).success ? (data?.message || 'Request failed') : 'Request failed');
  return data as T;
}
```

**状态（Zustand）** `src/state/auth.ts`

```ts
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';

type AuthState = {
  token: string | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};
export const useAuth = create<AuthState>((set) => ({
  token: null,
  async login(email, password) {
    const res = await api<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await SecureStore.setItemAsync('token', res.token);
    set({ token: res.token });
  },
  async logout() {
    await SecureStore.deleteItemAsync('token');
    set({ token: null });
  }
}));
```

**导航** `src/navigation/index.tsx`

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../screens/Login';
import Wardrobe from '../screens/Wardrobe';
import Capture from '../screens/Capture';

const Stack = createNativeStackNavigator();
export default function RootNav() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={Login} options={{ title: '登录' }} />
        <Stack.Screen name="Wardrobe" component={Wardrobe} options={{ title: '我的衣柜' }} />
        <Stack.Screen name="Capture" component={Capture} options={{ title: '拍照' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**登录页** `src/screens/Login.tsx`

```tsx
import { useState } from 'react';
import { View, TextInput, Button, Text, Alert } from 'react-native';
import { useAuth } from '../state/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export default function Login({ navigation }: NativeStackScreenProps<any>) {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await login(email, password);
      navigation.replace('Wardrobe');
    } catch (e: any) {
      Alert.alert('登录失败', e.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text>邮箱</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth: 1, marginBottom: 12 }} />
      <Text>密码</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, marginBottom: 12 }} />
      <Button title={loading ? '登录中…' : '登录'} onPress={onSubmit} />
    </View>
  );
}
```

**衣柜页** `src/screens/Wardrobe.tsx`

```tsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, Button } from 'react-native';
import { api } from '../api/client';

type Item = { id: string; name: string; imageUrl: string; createdAt: string; };
export default function Wardrobe({ navigation }: any) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => { api<{items: Item[]}>('/wardrobe').then(d => setItems(d.items)); }, []);
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Button title="拍照添加" onPress={() => navigation.navigate('Capture')} />
      <FlatList data={items} keyExtractor={(i) => i.id}
        renderItem={({ item }) => (<View style={{ paddingVertical: 8 }}><Text>{item.name}</Text></View>)}
        ListEmptyComponent={<Text>暂无衣物</Text>}
      />
    </View>
  );
}
```

**拍照页（示例）** `src/screens/Capture.tsx`

```tsx
import { useState, useEffect } from 'react';
import { View, Button, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';

export default function Capture() {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { ImagePicker.requestCameraPermissionsAsync(); }, []);
  const takePhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) setUri(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };
  const upload = async () => {
    if (!uri) return;
    try {
      await api('/wardrobe', { method: 'POST', body: JSON.stringify({ imageDataUrl: uri }) });
      Alert.alert('已上传');
    } catch (e: any) { Alert.alert('失败', e.message || '请稍后重试'); }
  };
  return (
    <View style={{ padding: 16 }}>
      <Button title="拍照" onPress={takePhoto} />
      {uri && <Image source={{ uri }} style={{ width: '100%', height: 320, marginVertical: 12 }} />}
      <Button title="上传" onPress={upload} disabled={!uri} />
    </View>
  );
}
```

**App 入口** `App.tsx`

```tsx
import RootNav from './src/navigation';
export default function App() { return <RootNav />; }
```

> **发布**：使用 Expo 官方 **Launch / EAS** 工作流到 App Store / Play（文档含向导）。([Expo Documentation][5])

---

# 7. 提示词与审查清单模板（可直接复用）

## 7.1 “好问题”通用模板

```
【背景】Next.js 14 + Express + MySQL + Redis；这里是相关文件/目录：
- frontend/src/app/orders/page.tsx（现状…）
- backend/src/routes/orders.js（现状…）

【需求】在 orders 页面实现分页+状态筛选；后端新增 /api/orders/me；前端从 /api/orders 代理获取。

【约束】TypeScript；App Router；Tailwind；Knex；不改公共中间件；保持鉴权；错误态需提示。

【输出期望】
1) 所有改动文件的 diff；2) 迁移与回滚；3) 最小单测；4) 风险点与边界；
5) 本地验证步骤（起服务、插入种子、访问路径）。
```

## 7.2 代码审查清单（AI+人工）

* [ ] 代码能跑？本地起服务通过
* [ ] 风险点列出：安全（注入/XSS/越权）、异常处理、空态
* [ ] 性能：是否分页/索引/缓存；是否出现 N+1
* [ ] 规范：命名、目录、类型、lint
* [ ] 变更面：数据库迁移是否有回滚；是否增加日志
* [ ] 验收：是否有最小测试、截图与操作步骤

**让 AI 审查**：

```
请按以下清单逐项审查这个 diff，并指出每一项是否合格：
- 安全风险（XSS/SQL注入/越权）
- 性能（N+1、分页、索引）
- 边界（空数据、失败、超时）
- 代码风格（命名、类型）
最后给出“必须修改项”列表，并提供对应的最小修复补丁。
```

## 7.3 调试/修复模板

```
【异常现象】接口 /api/x 返回 500：<错误栈/日志>
【已尝试】…（例如替换参数、禁用缓存）
【请输出】
1) 可能原因 Top-5（按概率排序）
2) 各原因的验证步骤
3) 最小可行修复（diff）
4) 回归测试点（含空态/错误态）
```

---

# 8. 项目管理与协作（AI 当“多人团队”）

* **角色分工**

  * GPT‑5 Pro：架构师/技术顾问（做决策与权衡）
  * Claude Code：全栈工程师/审查员（改库、重构、写测）
  * Cursor：日常开发与调试
  * Copilot：补全助手
  * 你：产品经理 + 项目经理 + 测试
* **工作流**

  1. PRD → GPT‑5 Pro 评审与拆解 → Issues
  2. Claude Code 批量生成代码与测试
  3. Cursor 日常微迭代 + 联调
  4. Claude Code 审查 → GPT‑5 Pro 二次把关（风险/回滚）
  5. 测试 → 部署 → 复盘
* **沟通机制**：保持同一对话上下文；持续反馈实际运行结果；关键决策入 `docs/`.

---

# 9. “从零到一”的发布与运维清单

* **CI/CD**：

  * Web（Vercel/自建）：`build → test → deploy`
  * API（Render/Fly.io/自建）：`docker build → test → deploy`
* **环境**：`dev` / `staging` / `prod` 三套 `.env`
* **数据库**：Knex 迁移流水线 + 备份；
* **监控**：错误（Sentry/自建）、日志（pino + 索引）、健康检查 `/healthz`；
* **安全**：密钥管理（环境注入）、CORS、限流、防重放（幂等键）。

---

# 10. 验证学习效果（里程碑）

* **Week 1**：能运行项目 + 改1处功能 + 提交PR
* **Week 4**：能独立新增1个前端页面 + 1个后端接口 + 1个Knex迁移
* **Month 2**：独立交付“公告/订单管理”端到端功能
* **Month 3**：完成一次“任务状态流”重构（SSE/WS 降级）+ 起一个 RN App 骨架并联通后端

---

# 11. 三个阶段的进阶路线

## 0–3 个月：从0到独立开发者

* 熟悉工具链与工作流；
* 能拆需求、写接口、做页面、联调、上测试环境；
* 建立“AI提示词资产库”。

## 4–6 个月：走向小型架构师

* 掌握任务编排（队列、重试、幂等）；
* 安全基线（鉴权、权限、审计）；
* 性能优化与可观测；
* 管理多环境发布与回滚。

## 1 年：技术创始人

* 体系化工程质量（测试金字塔、可观测平台）；
* 数据合规与隐私（日志脱敏、权限审计）；
* 演进式架构（微服务/模块化的边界）；
* 人机协作流程标准化（文档、提示词、复盘模板产品化）。

---

# 12. 立即行动（实操清单）

**今天**

1. 安装 Cursor / Copilot；克隆项目；起前后端。
2. 让 Claude Code 生成《项目全景图》到 `docs/architecture/overview.md`。
3. 建立保护分支规则；创建 `feat/first-change`，做首页小改并合并。([GitHub Docs][6])

**本周**

1. 完成“订单列表”端到端功能（用上面的骨架）；
2. 写一篇 `docs/weekly/Week1.md` 总结：遇到的坑 + 有效提示词 + 截图；
3. 为后端加 `GET /healthz` 与基础日志；
4. 选定 RN + Expo，创建空白项目跑通模拟器。([Expo Documentation][5])

---

## 附：精选“模板库”（可直接复制到你的仓库）

**A. Issue 模板** `.github/ISSUE_TEMPLATE/feature.md`

```md
## 背景
## 需求（用户故事/验收条件）
## 技术约束（栈/库/不能改的部分）
## 输出（文件/接口/页面/截图）
## 验收清单（空态/失败态/权限/性能）
```

**B. PR 模板** `.github/pull_request_template.md`

```md
### 变更说明
### 风险点与对策
### 自测步骤与截图
### 回滚方案
```

**C. 分支命名与保护**

* `feat/*`、`fix/*`、`chore/*`；
* 主分支 `main` 开启：**Require PR**、**Require status checks**、**Require approvals**。([GitHub Docs][6])

**D. Redis 缓存包装器（最小）**

```js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
async function cacheGetOrSet(key, ttlSec, fn) {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);
  const val = await fn();
  await redis.set(key, JSON.stringify(val), 'EX', ttlSec);
  return val;
}
module.exports = { redis, cacheGetOrSet };
```

**E. Knex 查询示例（防注入 & 分页）**

```js
const rows = await db('orders')
  .where({ user_id: uid })
  .modify((q) => { if (status) q.andWhere({ status }); })
  .orderBy('created_at', 'desc')
  .limit(pageSize)
  .offset((page - 1) * pageSize);
```

---

# 结语

你不需要先成为传统意义上的“程序员”。你的优势是：**用 AI 作为一支可调度的工程团队**。
把本文的**工作流/提示词/清单/骨架代码**落实到你的仓库，**每周产出一个“可点击的成果”**，3 个月你将具备**独立端到端开发**能力；6 个月你可以做**小型架构与技术决策**；1 年你将成为**技术创始人**，能带着 AI 团队（而不一定是真人团队）跑出你的产品。

> 需要我把以上内容打包成你的**项目专属“操作手册仓库”**（含模板、脚手架、CI 配置）吗？给我你的仓库结构与目标功能清单，我会按本文结构直接产出可用的 docs、prompts、脚手架与首批 Issues。

[1]: https://docs.claude.com/en/docs/claude-code/overview?utm_source=chatgpt.com "Claude Code overview"
[2]: https://cursor.com/features?utm_source=chatgpt.com "Features · Cursor"
[3]: https://docs.github.com/en/copilot/get-started/plans?utm_source=chatgpt.com "Plans for GitHub Copilot"
[4]: https://vercel.com/blog/announcing-v0-generative-ui?utm_source=chatgpt.com "Announcing v0: Generative UI"
[5]: https://docs.expo.dev/?utm_source=chatgpt.com "Expo Documentation"
[6]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule?utm_source=chatgpt.com "Managing a branch protection rule - GitHub Docs"
[7]: https://knexjs.org/?utm_source=chatgpt.com "Knex.js: SQL Query Builder for Javascript"
[8]: https://cursor.com/pricing?utm_source=chatgpt.com "Pricing"
[9]: https://www.anthropic.com/news/claude-code-on-the-web?utm_source=chatgpt.com "Claude Code on the web"
