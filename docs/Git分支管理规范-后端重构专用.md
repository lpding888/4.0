# Git分支管理规范 - 后端重构专用

> **适用项目**: 后端架构重构（18个任务）
> **制定人**: 老王
> **制定时间**: 2025-11-02

---

## 🎯 为什么必须设立分支？

### ❌ 不设分支的后果
1. **代码混乱**: 18个任务同时在develop分支开发，冲突一片
2. **无法回滚**: 某个任务出问题，整个develop分支都废了
3. **测试困难**: 无法单独测试某个功能，必须等所有功能都完成
4. **上线风险**: 无法灰度发布，只能一次性上线所有改动
5. **协作混乱**: 多个开发同时修改同一文件，冲突解决不完

### ✅ 设立分支的好处
1. **隔离开发**: 每个任务独立分支，互不影响
2. **快速回滚**: 某个任务有问题，直接删除分支重来
3. **独立测试**: 每个分支可以独立测试、独立部署
4. **灰度发布**: 可以先上线P0任务，P1任务延后上线
5. **代码审查**: 每个分支提PR，Reviewer逐个审查

---

## 📋 分支命名规范

### 主分支
```
main/master     - 生产环境分支（受保护，禁止直接push）
develop         - 开发环境分支（受保护，只能通过PR合并）
```

### 功能分支（Feature Branch）
```
格式: feature/TASK-ID-简短描述

示例:
feature/P0-001-saga-quota         - P0-001 Saga模式配额管理
feature/P0-002-dual-token-jwt     - P0-002 双Token JWT系统
feature/P0-003-knex-pool          - P0-003 Knex连接池优化
feature/P0-004-pipeline-limit     - P0-004 Pipeline并发控制
feature/P0-005-cos-cost-control   - P0-005 COS成本控制
feature/P0-006-wechat-login       - P0-006 微信登录集成
feature/P0-007-password-refactor  - P0-007 密码登录重构
feature/P0-008-payment-sdk        - P0-008 支付SDK集成
feature/P0-009-unified-auth       - P0-009 统一认证中间件

feature/P1-010-redis-cache        - P1-010 Redis缓存服务
feature/P1-011-websocket-push     - P1-011 WebSocket任务推送
... 以此类推
```

### 修复分支（Bugfix Branch）
```
格式: bugfix/TASK-ID-简短描述

示例:
bugfix/P0-001-fix-reserve-lock    - 修复reserve方法的锁问题
bugfix/P0-002-fix-token-refresh   - 修复Token刷新逻辑
```

### 热修复分支（Hotfix Branch）
```
格式: hotfix/简短描述

示例:
hotfix/quota-rollback-urgent      - 紧急修复配额回滚问题
hotfix/payment-callback-error     - 紧急修复支付回调错误
```

---

## 🔄 分支工作流程

### 标准流程（Feature Branch Workflow）

#### 1. 创建功能分支
```bash
# 从develop分支拉取最新代码
git checkout develop
git pull origin develop

# 创建并切换到功能分支
git checkout -b feature/P0-001-saga-quota

# 推送到远程仓库
git push -u origin feature/P0-001-saga-quota
```

#### 2. 开发过程中（提交代码）
```bash
# 查看修改的文件
git status

# 添加修改的文件
git add backend/src/services/quota.service.ts
git add backend/src/db/migrations/20250102000001_create_quota_transactions.ts

# 提交代码（使用规范的commit message）
git commit -m "feat(quota): 实现Saga模式配额管理

- 创建quota_transactions表
- 实现reserve/confirm/cancel方法
- 添加forUpdate行级锁
- 实现幂等性检查

Refs: #P0-001"

# 推送到远程分支
git push origin feature/P0-001-saga-quota
```

#### 3. 定期同步develop分支（避免冲突）
```bash
# 切换到develop分支拉取最新代码
git checkout develop
git pull origin develop

# 切换回功能分支
git checkout feature/P0-001-saga-quota

# 合并develop的最新代码到功能分支
git merge develop

# 如果有冲突，解决冲突后再提交
git add .
git commit -m "chore: 合并develop分支最新代码"
git push origin feature/P0-001-saga-quota
```

#### 4. 完成开发，提交PR
```bash
# 确保代码已提交并推送
git push origin feature/P0-001-saga-quota

# 在GitHub/GitLab/Gitee上创建Pull Request
# 标题: [P0-001] Saga模式配额管理
# 描述:
#   - 实现了什么功能
#   - 解决了什么问题
#   - 测试覆盖率
#   - 是否需要数据库迁移
```

#### 5. Code Review通过后合并
```bash
# 方式1: 在Web界面点击"Merge Pull Request"

# 方式2: 命令行合并（不推荐）
git checkout develop
git pull origin develop
git merge --no-ff feature/P0-001-saga-quota
git push origin develop

# 合并后删除功能分支
git branch -d feature/P0-001-saga-quota
git push origin --delete feature/P0-001-saga-quota
```

---

## 📝 Commit Message规范

### 格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type类型
```
feat     - 新功能
fix      - 修复bug
docs     - 文档修改
style    - 代码格式（不影响代码运行）
refactor - 重构（既不是新功能也不是修复bug）
perf     - 性能优化
test     - 测试相关
chore    - 构建过程或辅助工具的变动
```

### 示例
```bash
# 新功能
git commit -m "feat(quota): 实现Saga模式配额管理

- 创建quota_transactions表
- 实现reserve/confirm/cancel方法
- 集成到TaskService和PipelineEngine

Refs: #P0-001"

# 修复bug
git commit -m "fix(quota): 修复cancel方法的幂等性问题

- 添加phase状态检查
- 防止重复退还配额

Refs: #P0-001"

# 重构
git commit -m "refactor(auth): 统一认证中间件

- 删除旧的auth.middleware.js
- 所有路由迁移到新middleware
- JWT统一包含role字段

Refs: #P0-009"

# 测试
git commit -m "test(quota): 添加Saga模式单元测试

- 测试reserve/confirm/cancel流程
- 测试幂等性
- 测试并发场景

Refs: #P0-001"
```

---

## 🚦 分支保护规则

### develop分支保护
```yaml
保护设置:
  - 禁止直接push，只能通过PR合并
  - PR必须经过Code Review（至少1人approve）
  - PR必须通过CI/CD测试
  - PR必须解决所有冲突
  - PR合并后自动删除源分支
```

### main/master分支保护
```yaml
保护设置:
  - 禁止直接push
  - 只能从develop分支合并
  - 必须经过QA验收
  - 必须打Tag（版本号）
  - 必须有上线计划
```

---

## 📊 分支生命周期

### P0-001任务的完整生命周期示例

```
Day 1 (2小时):
  创建分支: feature/P0-001-saga-quota
  └─ 完成数据库迁移文件
     └─ Commit: "feat(quota): 创建quota_transactions表"
     └─ Push到远程

Day 2 (4小时):
  └─ 实现QuotaService三个方法
     └─ Commit: "feat(quota): 实现reserve/confirm/cancel方法"
     └─ Push到远程
  └─ 同步develop分支（避免冲突）
     └─ git merge develop

Day 3 (2小时):
  └─ 集成到TaskService和PipelineEngine
     └─ Commit: "feat(quota): 集成Saga模式到任务和Pipeline"
     └─ Push到远程

Day 4 (2小时):
  └─ 编写单元测试和集成测试
     └─ Commit: "test(quota): 添加Saga模式完整测试"
     └─ Push到远程
  └─ 提交Pull Request
     └─ 标题: [P0-001] Saga模式配额管理
     └─ 请求Reviewer审查

Day 5 (1小时):
  └─ Code Review反馈
     └─ 修复问题
     └─ Commit: "fix(quota): 修复Code Review问题"
     └─ Push到远程
  └─ Reviewer Approve
  └─ 合并到develop分支
  └─ 删除feature分支

总耗时: 11小时（含Review和修复）
```

---

## ⚠️ 常见错误和解决方案

### 错误1: 忘记创建分支，直接在develop开发
```bash
# 补救方法：将当前修改移动到新分支
git stash                              # 暂存当前修改
git checkout develop                   # 切换到develop
git pull origin develop                # 拉取最新代码
git checkout -b feature/P0-001-saga    # 创建新分支
git stash pop                          # 恢复暂存的修改
```

### 错误2: 分支太久没同步develop，冲突严重
```bash
# 预防方法：每天都同步一次develop
git checkout develop
git pull origin develop
git checkout feature/P0-001-saga
git merge develop

# 如果冲突太严重，重新创建分支
git checkout develop
git pull origin develop
git checkout -b feature/P0-001-saga-v2
# 手动复制代码过来
```

### 错误3: Commit太多，PR太大
```bash
# 预防方法：使用Squash合并
# 在GitHub/GitLab上选择"Squash and Merge"
# 将多个commit合并为一个

# 或者手动Squash（高级操作）
git rebase -i HEAD~5  # 合并最近5个commit
```

### 错误4: 误删分支
```bash
# 恢复方法：
git reflog                             # 查看操作历史
git checkout -b feature/P0-001-saga <commit-hash>  # 恢复分支
```

---

## 🎯 给你同事的具体指令

### P0-001任务的分支操作指令

```bash
# ========== 第1步：创建分支 ==========
git checkout develop
git pull origin develop
git checkout -b feature/P0-001-saga-quota
git push -u origin feature/P0-001-saga-quota

# ========== 第2步：开发过程中（每完成一个小模块就提交一次） ==========

# 完成数据库迁移后
git add backend/src/db/migrations/20250102000001_create_quota_transactions.ts
git commit -m "feat(quota): 创建quota_transactions表

- 字段：id, task_id, user_id, amount, phase, idempotent_done
- 索引：task_id唯一索引
- 枚举：phase三种状态（reserved/confirmed/cancelled）

Refs: #P0-001"
git push origin feature/P0-001-saga-quota

# 完成QuotaService后
git add backend/src/services/quota.service.ts
git commit -m "feat(quota): 实现QuotaService三个方法

- reserve(): 预留配额，使用forUpdate锁
- confirm(): 确认扣减，幂等性检查
- cancel(): 退还配额，幂等性检查

Refs: #P0-001"
git push origin feature/P0-001-saga-quota

# 完成系统集成后
git add backend/src/services/task.service.ts
git add backend/src/services/pipelineEngine.service.ts
git commit -m "feat(quota): 集成Saga模式到TaskService和PipelineEngine

- TaskService: 创建任务前调用reserve()
- PipelineEngine: 成功调用confirm()，失败调用cancel()

Refs: #P0-001"
git push origin feature/P0-001-saga-quota

# 完成测试后
git add backend/tests/services/quota.service.spec.ts
git add backend/tests/integration/quota-saga.spec.ts
git commit -m "test(quota): 添加Saga模式完整测试

- 单元测试：reserve/confirm/cancel流程
- 单元测试：幂等性和并发场景
- 集成测试：端到端Pipeline成功和失败流程
- 测试覆盖率：87%

Refs: #P0-001"
git push origin feature/P0-001-saga-quota

# ========== 第3步：提交PR ==========
# 在GitHub/GitLab/Gitee上创建Pull Request
# Base: develop
# Compare: feature/P0-001-saga-quota
# 标题: [P0-001] Saga模式配额管理
# 描述: （见下方PR模板）

# ========== 第4步：Code Review修复 ==========
# Reviewer提出问题后修复
git add .
git commit -m "fix(quota): 修复Code Review问题

- 优化reserve方法的错误处理
- 修复cancel方法的幂等性判断
- 补充测试用例

Refs: #P0-001"
git push origin feature/P0-001-saga-quota

# ========== 第5步：合并后清理 ==========
# PR合并后，删除本地和远程分支
git checkout develop
git pull origin develop
git branch -d feature/P0-001-saga-quota
git push origin --delete feature/P0-001-saga-quota
```

---

## 📋 Pull Request模板

```markdown
## [P0-001] Saga模式配额管理

### 任务描述
实现Saga模式配额管理，解决Pipeline执行失败时配额无法回滚的问题。

### 完成的工作
- [x] 创建`quota_transactions`表（迁移文件）
- [x] 实现`QuotaService.reserve()`方法（预留配额）
- [x] 实现`QuotaService.confirm()`方法（确认扣减）
- [x] 实现`QuotaService.cancel()`方法（退还配额）
- [x] 集成到`TaskService`（创建任务时调用reserve）
- [x] 集成到`PipelineEngine`（成功/失败调用confirm/cancel）
- [x] 单元测试（覆盖率87%）
- [x] 集成测试（端到端测试）

### 关键技术点
- 使用Knex事务确保原子性
- 使用forUpdate()行级锁防止并发超卖
- 幂等性设计：同一taskId的confirm/cancel只执行一次
- 三阶段状态管理：reserved → confirmed | cancelled

### 数据库变更
- 新增表：`quota_transactions`
- 迁移脚本：`backend/src/db/migrations/20250102000001_create_quota_transactions.ts`

### 测试结果
- 单元测试：✅ 通过（15个测试用例）
- 集成测试：✅ 通过（2个测试用例）
- 测试覆盖率：✅ 87%

### 验收标准
- [x] Pipeline执行失败时，配额能正确退还
- [x] 重复confirm/cancel不会重复操作（幂等性）
- [x] 并发场景下不会超卖配额
- [x] 单元测试覆盖率≥85%

### Reviewer检查清单
- [ ] 事务使用是否正确？
- [ ] forUpdate锁是否正确使用？
- [ ] 幂等性设计是否完善？
- [ ] 错误处理是否完善？
- [ ] 测试用例是否充分？

### 参考文档
- 任务卡：`tasks/backend-refactor/P0-001-saga-quota-management.json`
- 技术方案：`docs/后端架构问题解决回答` 第4节

/cc @reviewer-name
```

---

## 📌 老王的最终建议

### ✅ 必须做的
1. **每个任务都创建独立分支**（18个任务 = 18个分支）
2. **分支命名规范**（feature/TASK-ID-简短描述）
3. **提交信息规范**（feat/fix/refactor等类型前缀）
4. **定期同步develop**（每天至少一次，避免冲突）
5. **所有代码通过PR合并**（禁止直接push到develop）

### ✅ 推荐做的
1. **小步提交**（每完成一个小模块就commit一次）
2. **详细的PR描述**（使用上面的PR模板）
3. **自己先自测**（提PR前先跑一遍测试）
4. **及时回应Review**（Reviewer提出问题后24小时内修复）

### ❌ 禁止做的
1. **禁止直接在develop开发**（必须创建分支）
2. **禁止长期不合并**（分支超过1周不合并会冲突严重）
3. **禁止Force Push**（除非你知道自己在干什么）
4. **禁止绕过Code Review**（再急也要Review）

---

**制定人**: 老王（暴躁但专业的Git专家）
**生效日期**: 立即生效
**适用范围**: 后端架构重构所有18个任务
