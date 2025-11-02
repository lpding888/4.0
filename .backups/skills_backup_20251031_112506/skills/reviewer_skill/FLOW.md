# skills/reviewer_skill/FLOW.md

> 从"接收 PR"到"修复卡闭环"的标准流程（SOP）

## 流程图（Mermaid）

```mermaid
flowchart TD
  A[接收PR] --> B[契约/范围核对]
  B --> C[静态检查与脚本扫描]
  C --> D[运行基准/复现问题]
  D --> E{是否有问题?}
  E -- 否 --> F[出具报告: APPROVED] --> G[发布 REVIEW_APPROVED]
  E -- 是 --> H[分级: Blocker/Major/Minor]
  H --> I[撰写审查报告]
  I --> J{是否需修复卡?}
  J -- 是 --> K[创建 {原taskId}-FIX-XX 修复卡]
  K --> L[发布 REVIEW_CHANGES_REQUESTED]
  L --> M[执行部门修复]
  M --> N[复审修复卡]
  N -- 通过 --> G
  N -- 不通过 --> L
```

## 1) 接收 PR

* 获取：PR 链接、相关任务卡 ID、变更说明、OpenAPI/UI/事件契约、迁移脚本/部署脚本。
* 校验：**是否符合范围**（不能包含未授权的功能扩展）。

## 2) 契约/范围核对

* 对照 OpenAPI/UI/事件契约：参数/响应/错误码/事件名是否一致。
* 若发现**Breaking Change**且未走 CR 流程 → 直接判定 Blocker。

## 3) 静态检查与脚本扫描

* 运行脚本：
  * `scripts/check-openapi-sync.js`（契约一致性）
  * `scripts/greps.sh`（XSS/危险API扫描）
  * `scripts/scan-slow-queries.sql`（慢 SQL）
  * Lint/TypeCheck

## 4) 运行基准/复现问题

* Backend：用 `Supertest` + seed 数据做 P95 基准；
* Frontend：用 `Lighthouse` 或 E2E 流程测 FCP/TBT（可选）；
* SCF：模拟重复回调/签名错误。

## 5) 分级与报告

* 将发现的问题标注 Blocker/Major/Minor，写入报告，附**证据**与**建议**。

## 6) 是否签发修复卡

* 对 Blocker：**必须**签发修复卡；
* 对 Major：如不在本 PR 直接修复，则签发修复卡或登记技术债；
* 对 Minor：登记到技术债清单即可。

## 7) 发布事件

* 通过：`REVIEW_APPROVED`；
* 需要修改：`REVIEW_CHANGES_REQUESTED`（附修复卡列表）。

## 8) 复审

* 修复卡完成后，检查 `acceptanceCriteria` 是否达标；
* 成功 → 更新卡片 `status: ForReview -> QA`，并在 PR 中记录通过；
* 不达标 → 继续 `ChangesRequested`。

## SLA（建议）

* 普通 PR：**工作日 24 小时内**给出结论；
* Blocker 修复卡：**工作日 48 小时内**复审；
* 里程碑前最后 48 小时：拉齐优先级，集中审查。
