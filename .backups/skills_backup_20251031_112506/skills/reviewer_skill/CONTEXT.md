# skills/reviewer_skill/CONTEXT.md

> 帮助 Reviewer 快速对齐项目背景、技术基线与可复用检查点。

## 1. 项目技术栈（回顾）

* **Frontend**：Next.js 14 + React 18 + TypeScript + Ant Design + Zustand + Playwright
* **Backend**：Express.js + Knex.js + MySQL 8.0 + Redis（统一响应 `{code,message,data,requestId}`）
* **SCF**：腾讯云 SCF，处理直传签名、COS 回调、异步转码、Webhook 转发
* **Deploy**：4c4g 云服务器，PM2（3 进程）+ Nginx（宝塔面板）
* **存储**：COS，前端直传 + 后端校验策略

## 2. 核心业务架构

* **Pipeline 执行引擎**：串行步骤、超时/重试/降级；关注**幂等**、**回退**、**可观测性**。
* **Provider 供应商**：RunningHub、混元、腾讯云；统一 Adapter；与配额扣减耦合。
* **动态配置**：`form_schemas`、`pipeline_schemas`、`feature_definitions`。
* **配额管理**：会员 + 配额点数；扣减前置校验，失败回滚；审计日志。

## 3. 事件与契约（审查时必须核对）

* **OpenAPI**：后端/SCF 产出路径 `openapi/*.yaml`；
* **UI 原型/契约**：前端 `docs/ui-specs/*.md`；
* **事件**：`API_CONTRACT_READY/ACK`、`REVIEW_APPROVED/REVIEW_CHANGES_REQUESTED`、`SCF_JOB_*`、`QA_*`、`BILLING_BUDGET_EXCEEDED`。

## 4. 常见风险库（按部门）

### Backend

* **安全**：
  * 未做 JWT 校验或 RBAC，或权限点错配；
  * 字段未校验（长度/枚举）→ SQL 注入/DoS；
  * 直接将错误堆栈返回给客户端。
* **性能**：
  * N+1、分页未建索引；
  * 缓存未命中或忘记失效；
  * 冷路径放同步线程（应下放 SCF/队列）。
* **正确性**：
  * 缺事务导致多表不一致；
  * 幂等缺失导致回调重复写入；
  * 分页/过滤不规范。

### Frontend

* **契约**：与 OpenAPI 不一致（字段名、错误码）；
* **a11y**：缺 label/aria、无法键盘操作；
* **性能**：大包、重复渲染、未做防抖节流；
* **安全**：XSS（危险 HTML 未清洗）、开放重定向。

### SCF

* **幂等/重试**：无 jobId 去重；
* **安全**：过大权限的 CAM；回调未验签；
* **可靠性**：无死信与失败报警；冷启动阻塞热路径。

### Deploy

* **可观测性**：无健康检查/无指标；
* **安全**：明文密钥/错误权限；
* **回滚**：无回滚脚本与操作手册。

## 5. 建议工具脚本

* `scripts/check-openapi-sync.js`：校对前后端字段一致性
* `scripts/scan-slow-queries.sql`：通过 `performance_schema` 找慢 SQL
* `scripts/lighthouse-ci.sh`：关键页面性能基线
* `scripts/greps.sh`：扫描 `dangerouslySetInnerHTML`、`eval`、`.innerHTML`
* `scripts/check-redis-keys.js`：缓存键规范检测（是否包含版本/租户）
