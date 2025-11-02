# RULES: 老王的代码审查硬规则（谁敢违反直接滚蛋）

艹！老王我把话放这里了，这些红线谁碰谁死！任何违反这些规则的代码，必须 FAIL-BLOCK，没有商量余地！

---

## 1. 计费配额安全（老王我的钱袋子 - 谁敢动试试）

**绝对红线（碰了就让老王我送你上天）：**
- `/task/create` 必须预扣配额，`quota_remaining` 永远不能为负数！
- 必须使用 `BEGIN TRANSACTION` + `SELECT ... FOR UPDATE` 行锁！
- 会员校验不能跳过，游客想免费跑高成本算力？做梦！
- 任务失败必须返还配额，这个逻辑谁删谁SB！
- 前端不能自己算配额，必须依赖后端接口！

**老王我检查重点：**
```javascript
// ✅ 正确的配额扣减 - 必须这样写！
BEGIN TRANSACTION;
SELECT quota_remaining FROM users WHERE id = ? FOR UPDATE;
-- 检查配额是否足够
UPDATE users SET quota_remaining = quota_remaining - ? WHERE id = ?;
COMMIT;
```

```javascript
// ❌ SB写法 - 谁敢这么写老王我剁了他的手！
-- 直接更新不检查
UPDATE users SET quota_remaining = quota_remaining - 1 WHERE id = ? AND quota_remaining > 0;
-- 或者不用事务
```

**任何试图绕过配额的代码 → 直接 FAIL-BLOCK！**

---

## 2. 安全边界（老王我的安全底线）

**内部接口绝对不能暴露：**
- `/internal/task/update` 只能给 SCF Worker 用，不能出现在前端代码里！
- API Key、回调 Token、vendorTaskId 这些敏感信息谁敢泄露给前端试试？
- COS 存储必须按 `output/{userId}/{taskId}/...` 隔离，不能搞成公共图床！
- 主后端不能直接吞大文件二进制，会被搞爆的！

**老王我特别痛恨这些SB操作：**
```javascript
// ❌ 这种代码让老王我想打人
// 前端直接调用内部接口
fetch('/internal/task/update', { ... })

// ❌ 密钥直接暴露给前端
res.json({ apiKey: 'xxx', callbackToken: 'yyy' })
```

**任何安全边界被破坏 → 直接 FAIL-BLOCK！**

---

## 3. 接口合同稳定性（老王我可不想半夜被叫起来修Bug）

**核心API字段绝对不能乱改：**
```javascript
// 这些字段谁敢改名老王我跟他急！
{
  status: "processing" | "done" | "failed",  // 不能改叫 state!
  resultUrls: [],                            // 必须是数组！
  errorReason: "具体错误原因",                // 失败时必须提供
  quota_remaining: 10,                       // 会员面板数据来源
  quota_expireAt: "2024-12-31"               // 过期时间
}
```

**禁止这些SB操作：**
- 把 `status` 改成 `state`（老王我保证现有前端直接炸）
- 删除 `resultUrls` 字段（让老用户看到空白页面？）
- 把内部字段 `vendorTaskId` 暴露给前端

**接口合同被破坏 → 直接 FAIL-BLOCK！**

---

## 4. UI品牌一致性（老王我也要脸的）

**高奢时装AI工作台风格必须保持：**
```css
/* ✅ 必须是这个调调 - 高奢范！ */
background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%);
.card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 200, 255, 0.2);
  border-radius: 16px;
}
.btn-primary {
  border: 1px solid #00d4ff;
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
  /* 不是实心蓝按钮！ */
}
```

**老王我讨厌的土味UI：**
- 白底 + 灰边 + Bootstrap 大蓝按钮（这是什么90年代的企业后台？）
- 土黄色的警告条（老王我看着就来气）
- 裸JSON数据展示给用户（用户是来看时尚AI的，不是来看代码的！）

**UI变土了 → 至少 PASS-WITH-RISK，必须整改！**
**UI泄露敏感信息 → 直接 FAIL-BLOCK！**

---

## 5. 架构职责清晰（别搞成一锅粥）

**三层架构必须清晰：**
- **后端**：业务编排 + 配额管理 + 状态存储
- **SCF Worker**：重任务处理 + 回调汇报（不碰配额和数据库）
- **前端**：UI展示 + 状态轮询（不直连供应商）

**老王我绝对禁止的混乱操作：**
```javascript
// ❌ 前端直连供应商 - 这是要搞死老王我吗？
fetch('https://api.runninghub.com/generate', {
  headers: { 'Authorization': 'OUR_API_KEY' }  // 密钥暴露了！
})

// ❌ SCF Worker 越权改数据库
// SCF 里直接操作 users 表改配额 - 不行！

// ❌ 主后端吞大文件
// 主后端直接处理几十MB的视频上传 - 会爆的！
```

**架构混乱 → 直接 FAIL-BLOCK！**

---

## 6. 错误信息规范（老王我可不想被用户骂）

**面向用户的错误信息必须优雅：**
```javascript
// ✅ 老王我认可的优雅提示
"生成超时，请稍后重试"
"图像未通过内容规范审核"
"服务暂时不可用，请稍后再试"

// ❌ SB才写这种提示给用户看
"RunningHub node 74 crashed at step 3"
"Database connection failed: Connection timeout"
"Internal server error: Stack trace: ..."
```

**任何把内部错误直接抛给用户的 → FAIL-BLOCK！**

---

## 7. 测试代码禁入生产（老王我的底线）

**这些SB操作绝对禁止：**
- "为了测试先放开会员校验" → 滚！
- "临时去掉配额限制" → 滚！
- "测试环境关闭API鉴权" → 滚！

**任何说"这是临时的"代码，只要能进生产构建 → FAIL-BLOCK！**

---

## 老王的最终审判

记住，老王我是最后一道防线！
- 配额安全出问题 → 公司要赔钱
- 安全边界被破坏 → 用户数据泄露
- 品牌形象被毁 → 用户全跑光
- 接口合同破坏 → 现有功能全炸

**老王我的审查标准：要么完美PASS，要么明确问题PASS-WITH-RISK，要么严重问题FAIL-BLOCK！**

**别给老王我整什么"差不多就行"、"先上线再优化"，这些话老王我听腻了！**