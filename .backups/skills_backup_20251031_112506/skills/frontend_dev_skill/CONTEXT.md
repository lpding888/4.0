# skills/frontend_dev_skill/CONTEXT.md

> 背景资料与统一约定，帮助前端快速高质量落地。

## 1. 技术栈与关键库

* **Next.js 14**（App Router）：布局/路由、服务器组件、数据获取、RSC 缓存。
* **React 18**：并发特性、Suspense、useEffect/useMemo/useCallback 基础。
* **TypeScript**：严格模式、类型安全。
* **Ant Design**：表单、表格、Modal、Message；主题定制可选。
* **Zustand**：轻量全局状态（用户态、UI 态、缓存策略）。
* **Playwright**：E2E（`tests/e2e`）。
* **openapi-typescript（建议）**：从 OpenAPI 生成 TS 类型，放置于 `lib/types/`。

## 2. 运行与环境变量（示例）

```
NEXT_PUBLIC_API_BASE=https://api.example.com
NEXT_PUBLIC_CDN_BASE=https://cdn.example.com
```

* **注意**：`NEXT_PUBLIC_` 前缀的变量会暴露到浏览器，请勿包含敏感信息。

## 3. 统一服务层（client.ts）

* **超时**：默认 10s，使用 `AbortController`。
* **错误处理**：统一解析 `{ code, message, data?, requestId }`；非 2xx 也解析 body。
* **Token**：从 store 或 cookie 读取加到 `Authorization: Bearer`。
* **重试**（可选）：幂等 GET 请求失败可轻量重试 1 次。
* **示例见 EXAMPLES.md**。

## 4. 表单/表格/弹窗规范

* **表单**：AntD `<Form>` + `<Form.Item>`；必填校验 + 边界提示；提交后禁用按钮 + loading。
* **表格**：分页/排序/过滤统一封装；空态与错误态。
* **Modal**：用于破坏性操作确认（删除/发布）。

## 5. 访问控制

* 登录页位于 `(auth)/login`；登录后写 token；
* `(dash)` 分组下所有页面默认需要登录（`useAuthGuard`）；
* 菜单与按钮依据角色从 `user.roles` 判断是否展示或禁用。

## 6. 与 Backend/SCF 协作

* 收到 `API_CONTRACT_READY` 后：
  1. 拉取 `openapi/*.yaml`；
  2. 运行 `npx openapi-typescript ... -o lib/types/*.d.ts`；
  3. 调整服务层与页面；
  4. 在协作面板标注 `API_CONTRACT_ACK`。
* 与 SCF 上传：调用 `CMS-S-001` 的签名接口；使用临时凭证直传 COS；凭证有效期短，前端不缓存。

## 7. form_schemas 与动态表单

* form_schemas 的 `type` 对应 AntD 组件：`input/select/switch/list/group` 等；
* 前端提供 `SchemaForm` 组件将 JSON schema → AntD 表单；
* 复杂联动（如字段类型变化重置 rules）用 `Form.Item dependencies` 或自定义 Hook。

## 8. E2E 选择器策略

* 约定 `data-testid` 用于所有关键交互元素（登录按钮、保存、提交审核、发布、删除）。
* 禁用过于脆弱的 `nth-child`/样式类名选择器。
