### 1) 工具与环境

* **E2E**：Playwright
* **API**：Jest + Supertest
* **性能**：k6
* **环境**：测试环境与数据隔离；变量统一在 `.env.test`。
* **账号**：`admin@test.local`（管理员）、`editor@test.local`（编辑）、`viewer@test.local`（只读）

### 2) 关键路径（CMS）

* 登录 → 建模（内容类型）→ 内容 CRUD → 审核发布 → 前台 API 可读。
* 媒体上传直传（SCF 签名）→ COS 回调 → 显示缩略图。
* RBAC：Admin/Editor/Viewer 权限矩阵。

### 3) 报告模板

```markdown
# 测试报告 - CMS MVP
- 版本: v0.1.0 (commit abc123)
- 环境: test-01
- 结论: 通过/不通过
- 概要: 运行 42 用例；失败 2；P95=180ms
- 风险: 媒体回调偶发 5xx（复现率 2%）
- 建议: 增加幂等与重试
```
