### QA Acceptance 测试示例

本文件包含E2E测试、API测试、k6性能脚本、任务卡等完整示例。

#### 主要内容包括：

1. **E2E（登录→建模→创建→发布）** - `tests/e2e/cms-happy-path.spec.ts`
   - 使用 Playwright
   - data-testid 选择器
   - 完整的用户操作流程

2. **API（鉴权与 CRUD）** - `tests/api/content-types.spec.ts`
   - Jest + Supertest
   - 鉴权测试（deny without token）
   - CRUD 操作验证

3. **k6 性能脚本（简化）** - `tests/perf/cms-items.js`
   - 并发20用户，持续1分钟
   - P95 < 200ms 阈值
   - 包含 Authorization header

4. **任务卡（QA）** - `CMS-Q-002`
   - 完整18字段任务卡
   - department: "QA"
   - 回归测试编排（鉴权/发布/媒体）

5. **错误示例**
   - 只点点点"人工点测"无脚本记录
   - 报告没有版本号/环境信息
   - 覆盖率不清楚、不可复现

详细代码示例请参考用户提供的完整文档。
