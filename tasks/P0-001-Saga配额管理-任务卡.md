# 【任务卡】P0-001: Saga模式配额管理

> **任务ID**: P0-001
> **优先级**: P0（最高）
> **预估工时**: 10小时
> **负责人**: [开发人员姓名]
> **截止日期**: [填写日期]

---

## 📋 任务目标

**解决问题**: Pipeline执行失败时，配额已扣除但无法回滚

**实现方案**: 使用Saga模式实现配额管理的三阶段事务补偿（Reserve → Confirm | Cancel）

---

## 🎯 核心要求

### 1. 数据库设计
创建 `quota_transactions` 表记录配额操作的各个阶段状态

### 2. 服务层实现
实现 `QuotaService` 三个核心方法：
- `reserve()` - 预留配额
- `confirm()` - 确认扣减
- `cancel()` - 退还配额

### 3. 系统集成
- `TaskService`: 创建任务前调用 `reserve()`
- `PipelineEngine`: 成功调用 `confirm()`，失败调用 `cancel()`

### 4. 质量要求
- 所有操作使用 Knex 事务包裹
- 使用 `forUpdate()` 行级锁防止并发
- 幂等性设计：同一任务的 confirm/cancel 只执行一次
- 单元测试覆盖率 ≥ 85%

---

## 📝 开发步骤

### 第0步：创建Git分支（5分钟）
```bash
git checkout develop
git pull origin develop
git checkout -b feature/P0-001-saga-quota
git push -u origin feature/P0-001-saga-quota
```

### 第1步：阅读技术方案（30分钟）
打开文件：`docs/后端架构问题解决回答`
重点阅读：第4节 - Saga模式完整实现

### 第2步：创建数据库迁移（30分钟）
**文件**: `backend/src/db/migrations/20250102000001_create_quota_transactions.ts`

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('quota_transactions', (table) => {
    table.string('id', 32).primary();
    table.string('task_id', 32).notNullable().unique();
    table.string('user_id', 32).notNullable();
    table.integer('amount').notNullable();
    table.enum('phase', ['reserved', 'confirmed', 'cancelled']).notNullable();
    table.boolean('idempotent_done').defaultTo(true);
    table.timestamps(true, true);

    table.index('task_id');
    table.index('user_id');
    table.index('phase');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('quota_transactions');
}
```

**提交代码**:
```bash
git add backend/src/db/migrations/20250102000001_create_quota_transactions.ts
git commit -m "feat(quota): 创建quota_transactions表"
git push origin feature/P0-001-saga-quota
```

### 第3步：实现QuotaService（3小时）
**文件**: `backend/src/services/quota.service.ts`

```typescript
import { db } from '../db';
import { AppError, ErrorCode } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class QuotaService {
  // 预留配额
  async reserve(userId: string, taskId: string, amount = 1): Promise<void> {
    return db.transaction(async (trx) => {
      // 1. 使用forUpdate锁定用户行
      const user = await trx('users')
        .where({ id: userId })
        .forUpdate()
        .first();

      // 2. 检查配额
      if (!user || user.quota_remaining < amount) {
        throw new AppError(
          ErrorCode.QUOTA_INSUFFICIENT,
          '配额不足,请续费',
          403
        );
      }

      // 3. 扣减配额
      await trx('users')
        .where({ id: userId })
        .update({
          quota_remaining: user.quota_remaining - amount,
        });

      // 4. 记录Reserved状态
      await trx('quota_transactions').insert({
        id: uuid().replace(/-/g, ''),
        task_id: taskId,
        user_id: userId,
        amount,
        phase: 'reserved',
        idempotent_done: true,
      });
    });
  }

  // 确认扣减
  async confirm(taskId: string): Promise<void> {
    const record = await db('quota_transactions')
      .where({ task_id: taskId, phase: 'reserved' })
      .first();

    if (!record || record.idempotent_done !== true) {
      return; // 幂等性检查
    }

    await db('quota_transactions')
      .where({ task_id: taskId })
      .update({ phase: 'confirmed' });
  }

  // 退还配额
  async cancel(taskId: string): Promise<void> {
    return db.transaction(async (trx) => {
      const record = await trx('quota_transactions')
        .where({ task_id: taskId, phase: 'reserved' })
        .first();

      if (!record || record.phase !== 'reserved') {
        return; // 幂等性检查
      }

      // 退还配额
      await trx('users')
        .where({ id: record.user_id })
        .increment('quota_remaining', record.amount);

      // 更新状态
      await trx('quota_transactions')
        .where({ task_id: taskId })
        .update({ phase: 'cancelled' });
    });
  }
}

export const quotaService = new QuotaService();
```

**提交代码**:
```bash
git add backend/src/services/quota.service.ts
git commit -m "feat(quota): 实现QuotaService三个方法

- reserve: 预留配额,使用forUpdate锁
- confirm: 确认扣减,幂等性检查
- cancel: 退还配额,幂等性检查"
git push origin feature/P0-001-saga-quota
```

### 第4步：集成到TaskService（30分钟）
**文件**: `backend/src/services/task.service.ts`

**修改 `createTask` 方法**:
```typescript
import { quotaService } from './quota.service';

async createTask(userId: string, featureId: string, inputData: any) {
  const taskId = uuid().replace(/-/g, '');

  // ⚠️ 先预留配额（失败则不创建任务）
  await quotaService.reserve(userId, taskId, 1);

  // 创建任务
  await db('tasks').insert({
    id: taskId,
    user_id: userId,
    feature_id: featureId,
    input_data: JSON.stringify(inputData),
    status: 'pending',
    created_at: db.fn.now(),
  });

  return taskId;
}
```

**提交代码**:
```bash
git add backend/src/services/task.service.ts
git commit -m "feat(quota): TaskService集成reserve方法"
git push origin feature/P0-001-saga-quota
```

### 第5步：集成到PipelineEngine（30分钟）
**文件**: `backend/src/services/pipelineEngine.service.ts`

**修改 `executePipeline` 方法**:
```typescript
import { quotaService } from './quota.service';

async executePipeline(taskId: string, featureId: string, inputData: any) {
  try {
    // 执行Pipeline逻辑
    const result = await this.executeSteps(taskId, steps, inputData);

    // ✅ 成功时确认配额扣减
    await quotaService.confirm(taskId);

    return result;
  } catch (error) {
    // ❌ 失败时取消配额扣减
    await quotaService.cancel(taskId);

    throw error;
  }
}
```

**提交代码**:
```bash
git add backend/src/services/pipelineEngine.service.ts
git commit -m "feat(quota): PipelineEngine集成confirm/cancel"
git push origin feature/P0-001-saga-quota
```

### 第6步：编写单元测试（2小时）
**文件**: `backend/tests/services/quota.service.spec.ts`

```typescript
import { quotaService } from '../../src/services/quota.service';
import { db } from '../../src/db';

describe('QuotaService - Saga模式', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db('quota_transactions').del();
  });

  it('应该正确预留配额', async () => {
    const userId = 'user123';
    const taskId = 'task456';

    await quotaService.reserve(userId, taskId, 1);

    const user = await db('users').where({ id: userId }).first();
    expect(user.quota_remaining).toBe(99);

    const record = await db('quota_transactions').where({ task_id: taskId }).first();
    expect(record.phase).toBe('reserved');
  });

  it('配额不足时应该抛出错误', async () => {
    const userId = 'user_no_quota';
    const taskId = 'task789';

    await expect(
      quotaService.reserve(userId, taskId, 100)
    ).rejects.toThrow('配额不足');
  });

  it('应该正确执行reserve → confirm流程', async () => {
    const userId = 'user123';
    const taskId = 'task101';

    await quotaService.reserve(userId, taskId, 1);
    await quotaService.confirm(taskId);

    const record = await db('quota_transactions').where({ task_id: taskId }).first();
    expect(record.phase).toBe('confirmed');
  });

  it('应该正确执行reserve → cancel流程', async () => {
    const userId = 'user123';
    const taskId = 'task102';

    await quotaService.reserve(userId, taskId, 1);
    let user = await db('users').where({ id: userId }).first();
    expect(user.quota_remaining).toBe(99);

    await quotaService.cancel(taskId);

    user = await db('users').where({ id: userId }).first();
    expect(user.quota_remaining).toBe(100); // 配额已退还

    const record = await db('quota_transactions').where({ task_id: taskId }).first();
    expect(record.phase).toBe('cancelled');
  });

  it('重复confirm应该是幂等的', async () => {
    const taskId = 'task103';

    await quotaService.reserve('user123', taskId, 1);
    await quotaService.confirm(taskId);
    await quotaService.confirm(taskId); // 重复调用

    const records = await db('quota_transactions').where({ task_id: taskId });
    expect(records.length).toBe(1);
  });

  it('重复cancel应该是幂等的', async () => {
    const taskId = 'task104';

    await quotaService.reserve('user123', taskId, 1);
    await quotaService.cancel(taskId);
    await quotaService.cancel(taskId); // 重复调用

    const user = await db('users').where({ id: 'user123' }).first();
    expect(user.quota_remaining).toBe(100); // 不会重复退还
  });
});
```

**提交代码**:
```bash
git add backend/tests/services/quota.service.spec.ts
git commit -m "test(quota): 添加QuotaService单元测试

- 测试reserve/confirm/cancel流程
- 测试幂等性
- 测试覆盖率: 87%"
git push origin feature/P0-001-saga-quota
```

### 第7步：编写集成测试（1小时）
**文件**: `backend/tests/integration/quota-saga.spec.ts`

```typescript
import { taskService } from '../../src/services/task.service';
import { pipelineEngine } from '../../src/services/pipelineEngine.service';
import { db } from '../../src/db';

describe('配额Saga集成测试', () => {
  it('创建任务 → Pipeline成功 → 配额confirm', async () => {
    const userId = 'user123';
    const taskId = await taskService.createTask(userId, 'feature1', {});

    await pipelineEngine.executePipeline(taskId, 'feature1', {});

    const record = await db('quota_transactions').where({ task_id: taskId }).first();
    expect(record.phase).toBe('confirmed');

    const user = await db('users').where({ id: userId }).first();
    expect(user.quota_remaining).toBe(99);
  });

  it('创建任务 → Pipeline失败 → 配额cancel', async () => {
    const userId = 'user123';
    const taskId = await taskService.createTask(userId, 'feature_fail', {});

    await expect(
      pipelineEngine.executePipeline(taskId, 'feature_fail', {})
    ).rejects.toThrow();

    const record = await db('quota_transactions').where({ task_id: taskId }).first();
    expect(record.phase).toBe('cancelled');

    const user = await db('users').where({ id: userId }).first();
    expect(user.quota_remaining).toBe(100); // 配额已退还
  });
});
```

**提交代码**:
```bash
git add backend/tests/integration/quota-saga.spec.ts
git commit -m "test(quota): 添加配额Saga集成测试"
git push origin feature/P0-001-saga-quota
```

### 第8步：提交Pull Request（30分钟）
在GitHub/GitLab创建PR，使用以下模板：

**标题**: `[P0-001] Saga模式配额管理`

**描述**:
```markdown
## 完成的工作
- [x] 创建quota_transactions表
- [x] 实现QuotaService.reserve()方法
- [x] 实现QuotaService.confirm()方法
- [x] 实现QuotaService.cancel()方法
- [x] 集成到TaskService
- [x] 集成到PipelineEngine
- [x] 单元测试（覆盖率87%）
- [x] 集成测试

## 关键技术点
- 使用Knex事务确保原子性
- 使用forUpdate()行级锁防止并发超卖
- 幂等性设计：同一taskId的confirm/cancel只执行一次
- 三阶段状态管理：reserved → confirmed | cancelled

## 数据库变更
- 新增表：quota_transactions

## 测试结果
- 单元测试：✅ 7个测试用例通过
- 集成测试：✅ 2个测试用例通过
- 测试覆盖率：✅ 87%
```

---

## ✅ 验收标准

提交PR前自检：

- [ ] Pipeline执行失败时，配额能正确退还
- [ ] 重复confirm/cancel不会重复操作（幂等性）
- [ ] 并发场景下不会超卖配额
- [ ] 单元测试覆盖率≥85%
- [ ] 所有测试通过
- [ ] 代码通过ESLint检查
- [ ] 已提交Pull Request

---

## 📚 参考资料

- **技术方案**: `docs/后端架构问题解决回答` 第4节
- **问题背景**: `docs/后端架构重构问题报告-GPT5专用.md` 问题1

---

## ⚠️ 注意事项

1. **必须先创建分支**: `feature/P0-001-saga-quota`
2. **forUpdate锁很重要**: 防止并发超卖
3. **幂等性很重要**: 防止重复confirm/cancel
4. **每个步骤都commit**: 方便Code Review
5. **不要跳过测试**: 测试覆盖率必须≥85%

---

## 🆘 遇到问题怎么办

1. 检查清单里的代码示例不够详细 → 打开 `docs/后端架构问题解决回答` 搜索"Saga模式"
2. forUpdate锁不会用 → 参考技术方案第4节的完整示例
3. 测试写不出来 → 参考上面的测试代码示例
4. 其他问题 → 随时找项目负责人

---

**任务卡创建时间**: 2025-11-02
**创建人**: 老王
