# skills/frontend_dev_skill/FLOW.md

> 标准工作流程（10 步）——确保契约一致、体验一致、质量可验。

## 流程图（Mermaid）

```mermaid
flowchart TD
  A[接收任务卡] --> B[阅读卡片与OpenAPI/协作契约]
  B --> C{需要澄清或CR?}
  C -- 是 --> C1[向Planner发澄清/CR并等待]
  C -- 否 --> D[生成/更新TS类型(代码生成)]
  D --> E[设计UI/状态/路由]
  E --> F[实现服务层与页面]
  F --> G[统一错误/空/载态与a11y]
  G --> H[编写E2E与自测]
  H --> I[提交PR→Reviewer]
  I --> J{通过?}
  J -- 否 --> J1[按修复卡/意见调整] --> I
  J -- 是 --> K[记录API_CONTRACT_ACK并交给QA]
```

### 1) 接收任务卡

* 确认 18 字段齐全；`needsCoordination` 是否涉及 Backend/SCF；
* 记录页面路径、选择器策略、E2E 验收点。

### 2) 阅读契约与原型

* 拉取 OpenAPI、UI 原型；若缺失 → 立即提出澄清。
* 若拟改参数/结构，走 Planner CR。

### 3) 代码生成类型

* 运行 `openapi-typescript` 生成 `lib/types/*.d.ts`（或采用手写类型，但不推荐）。
* 更新 `lib/services/*.ts` 的入参/出参类型。

### 4) 设计 UI/状态/路由

* 拆页面为**容器页** + **组件**；
* 规划局部 state 与全局 store；
* 设计空态/错误态/加载态；
* 访问控制点（按钮禁用/隐藏）。

### 5) 实现服务层与页面

* 统一走 `client.ts`；
* 表单/表格/Modal 按统一规范实现；
* 复杂交互拆 Hook（`usePagination/useUploader`）。

### 6) 体验一致化

* Loading 与 Disable；
* 错误 toast 与控制台 requestId；
* a11y：键盘可达，aria-label 完整；
* 国际化（可选）：基础 en/zh 切换。

### 7) E2E 与自测

* 基于 data-testid/role；
* 覆盖任务卡 `acceptanceCriteria` 的 Given/When/Then；
* 录制短视频作为 PR 说明（可选）。

### 8) 提交 PR

* 附：任务卡 ID、OpenAPI 版本、截图/视频、变更点、潜在风险与回滚；
* 请求 Reviewer 审查。

### 9) 调整/修复

* 根据 Reviewer 修复卡或意见优化；
* 根据 QA 冒烟反馈修复选择器或边界用例。

### 10) 记录 ACK

* 在协作面板记录 `API_CONTRACT_ACK`，并附 `lib/types/*.d.ts` 的生成命令与使用位置。
