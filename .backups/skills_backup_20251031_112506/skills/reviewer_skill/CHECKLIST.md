# skills/reviewer_skill/CHECKLIST.md

> 提交审查结论前，逐项自检（带反例）

## A. 通用（所有部门适用）

* [ ] 相关任务卡与范围已核对，未超范围。
* [ ] 有**契约**（OpenAPI/UI/事件）可引用，且实现一致。
* [ ] 审查意见**都有证据**（代码位置/日志/脚本/基准数据）。
* [ ] 问题已**分级**（Blocker/Major/Minor），并给出合并建议。
* [ ] 对 Blocker/必要的 Major 已**签发修复卡**（18 字段齐备）。
* [ ] 已发布 `REVIEW_APPROVED` 或 `REVIEW_CHANGES_REQUESTED` 事件。
  **反例**：只写"看起来不对"，无任何复现或数据。

## B. Backend 专项

* [ ] 鉴权/RBAC/输入校验到位；**未暴露原始错误堆栈**。
* [ ] 无明显 N+1；关键查询有**索引**；分页/过滤规范。
* [ ] 核心写操作在**事务**中；幂等控制（回调/重试）。
* [ ] Redis 缓存命中率合理，写操作做**精确失效**。
* [ ] 统一错误码，响应结构 `{code,message,data,requestId}`。
  **反例**：`SELECT * FROM ... WHERE name LIKE '%${q}%'`（注入风险）。

## C. Frontend 专项

* [ ] 与 OpenAPI 客户端类型一致；不直接裸 `fetch`。
* [ ] 关键按钮/输入有 `data-testid` 或 role/aria，E2E 稳定。
* [ ] 表单必填校验、加载/空/错态一致；
* [ ] 无大包误引/重复渲染热点；必要防抖/节流。
* [ ] 无 `dangerouslySetInnerHTML`（或有严格清洗）。
  **反例**：E2E 用 `.ant-btn:nth-child(2)`；slug 无校验。

## D. SCF 专项

* [ ] 回调**签名校验**；**jobId 幂等**；
* [ ] 失败**重试** + **死信**；
* [ ] CAM 最小权限；
* [ ] 冷启动不阻塞热路径。
  **反例**：重复回调导致重复入库；密钥写日志。

## E. Deploy 专项

* [ ] 健康检查、监控告警、发布后**自动化冒烟**；
* [ ] 回滚脚本 ≤ 3 分钟；
* [ ] 敏感配置未明文存储；
* [ ] PM2 配置、Nginx 反代规范。
  **反例**：发布失败手工回滚、无脚本。

## F. 修复任务卡质量（18 字段）

* [ ] `taskId` = `{原taskId}-FIX-{序号}`；
* [ ] `department` 为执行部门；
* [ ] `estimatedHours` 在 4–12 小时；
* [ ] `acceptanceCriteria` 可验证（性能/安全/UT 覆盖率/回归通过）；
* [ ] `aiPromptSuggestion`（system/user）清晰可执行；
* [ ] `createdByRole: "Reviewer"`；`status: "Ready"`。
  **反例**：无 `acceptanceCriteria`；夹带新功能需求。
