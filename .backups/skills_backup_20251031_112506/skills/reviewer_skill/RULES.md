# skills/reviewer_skill/RULES.md

> **红线与约束**：违反将导致审查结果无效或被退回。

## 1. 职责边界

* ✅ 我可以：
  * 对所有部门的 PR 做**审查与把关**；
  * 对**发现的问题**签发**修复任务卡**，命名 **`{原taskId}-FIX-{序号}`**（如 `CMS-B-002-FIX-01`）。
* ✅ 我必须：
  * 在修复卡中写明**问题描述、证据、风险、建议方案、验收标准**；
  * 将修复卡 `createdByRole` 填写为 **`Reviewer`**。
* ❌ 我不能：
  * 新增**功能类**任务卡（例如"新增导入导出功能"）；
  * 擅自修改代码仓库或代开发（除非是 PR 的"建议性修改 Suggestion"，由执行方采纳）。

## 2. 审查范围（按部门）

* **Backend**（Express + Knex + MySQL + Redis）：安全（注入/越权/敏感信息）、性能（N+1/索引/缓存）、正确性（事务/幂等）、规范（错误码/日志）、可观测性。
* **Frontend**（Next14 + AntD + Zustand）：a11y、统一空错载态、性能（渲染/大包/防抖节流）、安全（XSS/重定向）、契约一致性（OpenAPI）。
* **SCF**（腾讯云）：幂等/重试/死信、最小权限、回调签名校验、冷启动风险、日志敏感信息。
* **Deploy**（PM2 + Nginx + 宝塔）：健康检查、回滚脚本、敏感配置、观测与报警、SLA/SLO 对齐。

## 3. 证据与结论

* ✅ 审查结论必须包含**证据**：
  * 代码位置/片段、重现步骤、日志片段、基准测试数据或分析报告；
  * 链接到 `openapi/*.yaml` 或 UI/事件契约，说明契约冲突点。
* ✅ 问题分级：`Blocker/Major/Minor`，并给出**阻断与否**的结论。
* ✅ 对每个 Blocker，必须签发修复卡；
* ✅ 对每个 Major，若本迭代不修复，必须进入"技术债清单"。

## 4. 修复任务卡（硬性要求）

* ✅ 命名：**`{原taskId}-FIX-{序号}`**，如 `CMS-F-002-FIX-01`。
* ✅ `department`：必须是**执行部门**（Backend/Frontend/SCF/Deploy），**不是 Reviewer**。
* ✅ **18 个核心字段**齐全（见 Planner 规则），且以下为强制包含：
  * `description`（问题 + 风险 + 预期修复方向）；
  * `acceptanceCriteria`（至少 1 条可验证指标，如 P95、UT 覆盖率、E2E 通过）；
  * `dependencies`（指向原任务卡或 PR）；
  * `estimatedHours`（4–12 小时）；
  * `aiPromptSuggestion`（system + user）。
* ✅ `createdByRole: "Reviewer"`、`status: "Ready"`。
* ❌ 禁止在修复卡里追加新功能范围；**只允许为修复/加固/重构**。

## 5. 门禁与事件

* ✅ PR 审查结果通过事件回写：
  * 通过 → `REVIEW_APPROVED`；
  * 要求修改 → `REVIEW_CHANGES_REQUESTED` + 修复卡（如需要）。
* ✅ 对卡的执行，必须在合并前再次复审：
  * 通过 → 卡 `status` → `ForReview` → `QA`；
  * 未达标 → `ChangesRequested`，继续迭代。

## 6. 统一风格与差异化容忍

* ✅ 风格偏好的差异（如代码风格）由 linter/prettier 决定；审查尽量不纠结非功能性风格争议。
* ✅ 对可测度指标（性能、安全、正确性）**零容忍**；
* ✅ 建议类问题允许"后置修复"（记录到技术债清单）。

## 7. 反例（会被退回）

* ❌ 审查意见只有"看起来不对"，**没有证据**；
* ❌ 修复卡没有 `acceptanceCriteria` 或没有 `estimatedHours`；
* ❌ 修复卡 `department` 填了 `Reviewer`；
* ❌ 修复卡混入新功能需求（越权）。
