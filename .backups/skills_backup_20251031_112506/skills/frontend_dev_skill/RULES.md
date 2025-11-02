# skills/frontend_dev_skill/RULES.md

> 前端开发行为红线与约束。违反将触发 Reviewer/QA/Planner 退回。

## 契约与协作

* ✅ **必须**以 OpenAPI 为唯一事实来源：未收到 `API_CONTRACT_READY` 不得开始对接；对接完成必须 `ACK`。

* ✅ 与 Backend 的**任何 Breaking 变更**必须走 Planner 的 CR 流程并记录在变更日志。

* ✅ 与 SCF 的参数/回调交互，必须通过文档 `docs/cos-direct-upload.md`/事件契约确认。

* ❌ 不得擅自 Mock 与契约不一致的字段结构用于联调；临时 Mock 必须来源于 OpenAPI Example 并清楚标注"临时"。

## 技术与结构

* ✅ 页面默认 Server Components；**需要交互**（状态/事件/Effect）时使用 `use client`。

* ✅ 统一使用 **Ant Design** 组件；遵守表单/表格/弹窗模式；统一 Message/Modal 交互。

* ✅ **Zustand** 管理全局状态（用户态、UI 态），页面局部状态使用 React 局部 state。

* ✅ 服务层统一使用 `lib/services/client.ts`（fetch 包装：超时、取消、错误码统一处理）。

* ✅ 列表查询需抽象分页 Hook（`usePagination`），保持逻辑一致。

* ✅ 统一错误形态：后端返回 `{ code, message, data?, requestId }`，前端弹出 `message.error(message)` 并在控制台打印 `requestId`。

* ❌ 禁止在组件内直接写 `fetch('/api')`；必须走服务层。

* ❌ 禁止全局 store 滥用（只存跨页必要状态）。

* ❌ 禁止把长耗时/高成本操作绑定按钮连点（需 debounce/disable/loading）。

## 访问控制与安全

* ✅ 登录成功后写入令牌（推荐 httpOnly Cookie；若用 localStorage 必须同时在请求头传递并在页面可视范围外隐藏）。

* ✅ 基于角色隐藏菜单/禁用按钮；敏感操作二次确认（Modal.confirm）。

* ✅ 表单输入前端校验（长度、格式、选项）；上传文件检查类型/大小。

* ✅ 统一 XSS 防护（危险 HTML 渲染使用 `dangerouslySetInnerHTML` 前先清洗；业务尽量避免）。

* ✅ 路由守卫（`useAuthGuard` 或中间件）拦截未登录用户跳转到登录页。

* ❌ 禁止在日志/报错中打印用户隐私（邮箱、手机号、令牌）。

* ❌ 禁止以 `eval`、内联脚本等形式引入第三方不可信代码。

## 性能与体验

* ✅ 列表大数据采用**分页**/**虚拟滚动**（AntD Table + virtualization）。

* ✅ 表单提交显示 Loading；网络异常提供重试；

* ✅ 图片与媒体采用懒加载。

* ✅ 组件拆分 & 按需加载（`next/dynamic`）；大组件避免与全局 store 频繁联动。

* ❌ 禁止一次性引入全量大包（例如只需要小功能时引入整个图表库）。

* ❌ 禁止在 render 中创建**未 memo**的重对象或函数导致子树重复渲染。

## 测试与可访问性

* ✅ Playwright 覆盖核心路径；基于 `data-testid` 与可访问性 role 做选择器。
* ✅ 关键表单与按钮具备 label/aria 属性，键盘可达；
* ✅ 国际化（如启用）提供基础 en/zh 两份翻译文件并有语言切换入口。

## PR 与门禁

* ✅ PR 模板包含：变更点、相关任务卡、影响范围、截图/短视频、OpenAPI 版本、回滚策略。
* ✅ Reviewer 门禁：a11y、性能、规范一致性。
* ✅ QA 门禁：E2E 通过、冒烟通过。
* ✅ 完成后在协作面板记录 `API_CONTRACT_ACK` 与页面路径。
