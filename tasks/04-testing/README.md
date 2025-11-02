# 🧪 Testing 任务卡说明

## 任务卡文件清单

### 01-unit-integration-tests.json（3个任务，28小时）
- MOBILE-QA-001: 单元测试（覆盖率≥70%）（12h）
- MOBILE-QA-002: 集成测试（API集成测试）（8h）
- MOBILE-QA-003: 组件测试（React Testing Library）（8h）

### 02-e2e-tests.json（3个任务，20小时）
- MOBILE-QA-004: E2E测试（核心流程）（10h）
- MOBILE-QA-005: 性能测试（首屏<2s）（6h）
- MOBILE-QA-006: 安全审计（依赖扫描、代码审计）（4h）

## 核心策略

**测试金字塔原则：**
```
       /\
      /  \  E2E测试（20%）
     /____\
    /      \  集成测试（30%）
   /________\
  /          \  单元测试（50%）
 /____________\
```

## 技术栈

- **Jest**: 29.x（单元测试框架）
- **React Testing Library**: 14.x（组件测试）
- **Playwright**: 1.x（E2E测试）
- **ESLint**: 8.x（代码规范）
- **Snyk**: 依赖安全扫描

## 参考文档

- GPT-5方案：`../docs/GPT5-Pro战略问题集/回答/app前端设计方案.md`（第9节 测试策略）

---

**文档版本：** v1.0
**生成时间：** 2025-11-01
**维护者：** AI老王（Product Planner）
