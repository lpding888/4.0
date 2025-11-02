```mermaid
flowchart TD
  A[读取范围与卡片] --> B[制订测试计划(Smoke/Regression/Performance)]
  B --> C[准备环境与数据]
  C --> D[实现脚本(E2E/API/k6)]
  D --> E[执行并生成报告]
  E --> F{通过?}
  F -- 否 --> G[提缺陷并阻断上线 -> Reviewer/执行部门修复]
  G --> D
  F -- 是 --> H[签署验收结论 -> Deploy]
```

**要点**

* 数据：种子脚本 + 清理脚本；
* 选择器：`data-testid` + role/aria；
* 性能：P95 阈值；
* 安全：基本越权/未鉴权拒绝路径；
* 报告：失败重现步骤、截图/视频、日志附件。
