# skills/reviewer_skill/EXAMPLES.md

> 提供**可复制**的审查报告模板、真实审查案例与修复任务卡样例。

完整示例请参考用户提供的第4批Reviewer Skill手册内容。

## 主要示例内容包括：

1. **审查报告模板** - 可直接复制使用的markdown模板（摘要/契约一致性/问题分级/基准测试/结论）
2. **真实案例：后端PR审查** - N+1查询、错误映射不统一（含证据和基准脚本）
3. **真实案例：前端PR审查** - E2E选择器脆弱、表单校验缺失
4. **修复任务卡样例（Backend）** - CMS-B-002-FIX-01（18字段完整）
5. **修复任务卡样例（Frontend）** - CMS-F-002-FIX-01（E2E选择器+表单校验）
6. **修复任务卡样例（SCF）** - CMS-S-002-FIX-01（签名校验+幂等保护）
7. **修复任务卡样例（Deploy）** - CMS-D-001-FIX-01（回滚脚本+冒烟验证）

所有修复任务卡均采用 **`{原taskId}-FIX-{序号}`** 命名规范，包含完整的18个核心字段，特别是：
- description（问题+风险+预期修复方向）
- acceptanceCriteria（可验证指标如P95、UT覆盖率）
- aiPromptSuggestion（system+user双阶段提示词）
- createdByRole: "Reviewer"
- department: 执行部门（Backend/Frontend/SCF/Deploy）

所有案例都包含完整的证据（代码位置、复现步骤、基准数据）。
