# QA Acceptance Skill - 任务卡清单

## 任务1:功能卡片上线前人工验收

**产出物**:
- `tests/manual/FEATURE_CARD_CHECKLIST.md` (人工测试检查表)

**执行内容**:

### 1.1 验收流程
管理员在后台配置好新功能卡片后(is_enabled=false),QA 需要进行以下验收:

**第1步:配置完整性检查**
- [ ] feature_definition 所有字段已填写
- [ ] form_schema 结构正确,字段类型有效
- [ ] pipeline_schema 结构正确,steps 顺序合理
- [ ] quota_cost 和 rate_limit_policy 已设置
- [ ] plan_required 或 whitelist 已配置

**第2步:表单渲染测试**
- [ ] 前端能正确根据 form_schema 渲染表单
- [ ] 所有字段类型都能正确显示(imageUpload/enum/text/date等)
- [ ] required 验证生效
- [ ] validation 规则正确(文件大小/类型/数值范围)
- [ ] helpText 显示清晰

**第3步:功能生成测试(抽样3-5次)**
- [ ] 提交表单后任务创建成功
- [ ] 配额正确扣减
- [ ] pipeline 所有 steps 正确执行
- [ ] 生成结果质量达标:
  - 图片清晰,无压缩失真
  - 视频流畅,无花屏/卡顿
  - 字幕清晰可读
  - Logo/水印位置合适
- [ ] 结果正确保存(artifacts字段)
- [ ] 如果 save_to_asset_library=true,素材库已自动保存

**第4步:失败返配额测试**
- [ ] 模拟供应商超时,任务标记为 failed
- [ ] 配额正确返还
- [ ] 前端显示"生成失败,配额已自动返还"
- [ ] quota_logs 正确记录返还

**第5步:限流测试**
- [ ] 按 rate_limit_policy 限制正确拦截
- [ ] 超限时显示"操作过于频繁,请X分钟后再试"

**第6步:权限测试**
- [ ] 基础会员无法使用 PRO 功能
- [ ] 白名单功能只对指定账号可见
- [ ] 权限不足时显示"请升级会员"

**验收标准**:
- 抽样测试至少 3 次,全部成功
- 生成质量达到可售卖标准
- 失败场景配额返还正确
- 限流和权限控制正确

**禁止事项**:
- 禁止在运行时自动质检(质检只在 is_enabled=true 之前人工做)
- 禁止基于生成质量自动返配额
- 禁止跳过验收直接上线

**交付物**:
测试报告(Markdown 格式),包含:
- 测试时间
- 测试功能卡片 ID
- 抽样测试截图(至少 3 次成功案例)
- 失败场景测试截图
- 限流测试截图
- 验收结论:通过/不通过
- 如果不通过,列出问题清单

---

## 任务2:集成测试 - 三个完整功能流程

**产出物**:
- `tests/integration/featureCard.test.js`

**执行内容**:

### 2.1 测试场景1:主图清洁增强(单步同步)
```javascript
describe('主图清洁增强功能', () => {
  it('应该正确创建任务并同步返回结果', async () => {
    // 1. 登录基础会员
    const user = await createTestUser({ membership_level: '基础', quota_remaining: 10 });
    const token = await loginUser(user);
    
    // 2. 获取功能列表
    const features = await request(app)
      .get('/api/features')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    const cleanFeature = features.body.features.find(f => f.feature_id === 'basic_clean');
    expect(cleanFeature).toBeDefined();
    
    // 3. 创建任务
    const createResp = await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'basic_clean',
        input_data: {
          productImage: 'https://test-cos.../test_product.jpg',
          backgroundColor: 'white'
        }
      })
      .expect(200);
    
    const taskId = createResp.body.task_id;
    
    // 4. 检查配额扣减
    const userAfter = await db('users').where({ id: user.id }).first();
    expect(userAfter.quota_remaining).toBe(9);
    
    // 5. 轮询任务状态
    await waitFor(async () => {
      const task = await db('tasks').where({ id: taskId }).first();
      return task.status === 'success';
    }, 30000);
    
    // 6. 验证结果
    const task = await db('tasks').where({ id: taskId }).first();
    expect(task.status).toBe('success');
    expect(task.artifacts).toBeDefined();
    
    const artifacts = JSON.parse(task.artifacts);
    expect(artifacts.file_urls).toHaveLength(1);
    expect(artifacts.file_urls[0]).toMatch(/^https:\/\//);
  });
});
```

### 2.2 测试场景2:AI模特12分镜(单步异步)
```javascript
describe('AI模特12分镜功能', () => {
  it('应该正确创建异步任务并轮询拿到结果', async () => {
    // 1. 登录 PRO 会员
    const user = await createTestUser({ membership_level: 'PRO', quota_remaining: 20 });
    const token = await loginUser(user);
    
    // 2. 创建任务
    const createResp = await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'model_pose12',
        input_data: {
          garmentImage: 'https://test-cos.../test_garment.jpg',
          stylePreset: 'street',
          modelVibe: 'cool'
        }
      })
      .expect(200);
    
    const taskId = createResp.body.task_id;
    
    // 3. 检查配额扣减
    const userAfter = await db('users').where({ id: user.id }).first();
    expect(userAfter.quota_remaining).toBe(18); // quota_cost=2
    
    // 4. 轮询任务状态(最多等待 60 秒)
    await waitFor(async () => {
      const task = await db('tasks').where({ id: taskId }).first();
      return task.status === 'success';
    }, 60000);
    
    // 5. 验证结果
    const task = await db('tasks').where({ id: taskId }).first();
    expect(task.status).toBe('success');
    
    const artifacts = JSON.parse(task.artifacts);
    expect(artifacts.file_urls).toHaveLength(12);
    
    // 6. 验证素材库
    const assets = await db('assets').where({ task_id: taskId });
    expect(assets).toHaveLength(12); // save_to_asset_library=true
  });
});
```

### 2.3 测试场景3:上新合辑短片(多步:RUNNINGHUB + SCF)
```javascript
describe('上新合辑短片功能', () => {
  it('应该正确执行多步 pipeline 并拼接视频', async () => {
    // 1. 登录企业会员
    const user = await createTestUser({ membership_level: '企业', quota_remaining: 30 });
    const token = await loginUser(user);
    
    // 2. 创建任务
    const createResp = await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'weekly_drop_trailer',
        input_data: {
          skuImages: [
            'https://test-cos.../sku1.jpg',
            'https://test-cos.../sku2.jpg',
            'https://test-cos.../sku3.jpg'
          ],
          launchDate: '2025-11-01',
          tagline: '本周上新,直播见',
          logoUrl: 'https://test-cos.../logo.png'
        }
      })
      .expect(200);
    
    const taskId = createResp.body.task_id;
    
    // 3. 检查配额扣减
    const userAfter = await db('users').where({ id: user.id }).first();
    expect(userAfter.quota_remaining).toBe(27); // quota_cost=3
    
    // 4. 验证 task_steps 创建
    const steps = await db('task_steps').where({ task_id: taskId }).orderBy('step_index');
    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe('RUNNINGHUB_WORKFLOW');
    expect(steps[1].type).toBe('SCF_POST_PROCESS');
    
    // 5. 轮询任务状态(最多等待 120 秒)
    await waitFor(async () => {
      const task = await db('tasks').where({ id: taskId }).first();
      return task.status === 'success';
    }, 120000);
    
    // 6. 验证结果
    const task = await db('tasks').where({ id: taskId }).first();
    expect(task.status).toBe('success');
    
    const artifacts = JSON.parse(task.artifacts);
    expect(artifacts.type).toBe('video');
    expect(artifacts.file_urls).toHaveLength(1);
    expect(artifacts.file_urls[0]).toMatch(/\.mp4$/);
  });
});
```

**验收标准**:
- 所有测试用例通过
- 测试覆盖 3 个完整功能流程
- Mock 数据准备充分
- 测试环境与生产环境隔离

**禁止事项**:
- 禁止在测试中使用生产环境数据
- 禁止在测试中真实调用付费供应商(使用 mock)

**依赖项**:
- 测试数据库已初始化
- Mock 服务已启动(模拟供应商 API)

---

## 任务3:失败返配额测试

**产出物**:
- `tests/integration/quotaRefund.test.js`

**执行内容**:

### 3.1 测试场景:供应商超时导致失败
```javascript
describe('配额返还测试', () => {
  it('供应商超时时应该返还配额', async () => {
    // 1. 登录用户
    const user = await createTestUser({ quota_remaining: 10 });
    const token = await loginUser(user);
    
    // 2. Mock 供应商超时
    mockProviderTimeout('runninghub');
    
    // 3. 创建任务
    const createResp = await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'model_pose12',
        input_data: { garmentImage: 'https://test.jpg' }
      })
      .expect(200);
    
    const taskId = createResp.body.task_id;
    
    // 4. 检查配额已扣减
    let userAfter = await db('users').where({ id: user.id }).first();
    expect(userAfter.quota_remaining).toBe(8);
    
    // 5. 等待任务失败
    await waitFor(async () => {
      const task = await db('tasks').where({ id: taskId }).first();
      return task.status === 'failed';
    }, 30000);
    
    // 6. 验证配额已返还
    userAfter = await db('users').where({ id: user.id }).first();
    expect(userAfter.quota_remaining).toBe(10);
    
    // 7. 验证任务状态
    const task = await db('tasks').where({ id: taskId }).first();
    expect(task.status).toBe('failed');
    expect(task.eligible_for_refund).toBe(true);
    expect(task.refunded).toBe(true);
    
    // 8. 验证配额日志
    const logs = await db('quota_logs')
      .where({ user_id: user.id, task_id: taskId })
      .orderBy('created_at', 'asc');
    
    expect(logs).toHaveLength(2);
    expect(logs[0].type).toBe('deduct');
    expect(logs[0].amount).toBe(-2);
    expect(logs[1].type).toBe('refund');
    expect(logs[1].amount).toBe(2);
  });
  
  it('任务成功时不应该返还配额', async () => {
    const user = await createTestUser({ quota_remaining: 10 });
    const token = await loginUser(user);
    
    const createResp = await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'basic_clean',
        input_data: { productImage: 'https://test.jpg' }
      })
      .expect(200);
    
    const taskId = createResp.body.task_id;
    
    await waitFor(async () => {
      const task = await db('tasks').where({ id: taskId }).first();
      return task.status === 'success';
    }, 30000);
    
    // 配额不应返还
    const userAfter = await db('users').where({ id: user.id }).first();
    expect(userAfter.quota_remaining).toBe(9);
    
    const task = await db('tasks').where({ id: taskId }).first();
    expect(task.refunded).toBe(false);
  });
});
```

**验收标准**:
- 技术失败时配额正确返还
- 成功任务不返还配额
- quota_logs 正确记录返还操作
- 不会重复返还

**禁止事项**:
- 禁止基于主观评价返还配额

**依赖项**:
- Mock 工具已配置

---

## 任务4:限流测试

**产出物**:
- `tests/integration/rateLimit.test.js`

**执行内容**:

### 4.1 测试场景:hourly:3 限流策略
```javascript
describe('限流测试', () => {
  it('应该正确执行 hourly:3 限流策略', async () => {
    const user = await createTestUser({ quota_remaining: 100 });
    const token = await loginUser(user);
    
    // 1. 前 3 次请求成功
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/tasks/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          feature_id: 'model_pose12', // rate_limit_policy: "hourly:3"
          input_data: { garmentImage: 'https://test.jpg' }
        })
        .expect(200);
    }
    
    // 2. 第 4 次请求应该被拦截
    const resp4 = await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'model_pose12',
        input_data: { garmentImage: 'https://test.jpg' }
      })
      .expect(429);
    
    expect(resp4.body.error).toMatch(/操作过于频繁/);
  });
  
  it('时间窗口重置后应该允许再次请求', async () => {
    const user = await createTestUser({ quota_remaining: 100 });
    const token = await loginUser(user);
    
    // 模拟时间前进 1 小时
    await advanceTime(3600);
    
    // 应该能再次请求
    await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'model_pose12',
        input_data: { garmentImage: 'https://test.jpg' }
      })
      .expect(200);
  });
});
```

**验收标准**:
- 限流策略正确执行
- 超限时返回 429 错误
- 时间窗口滚动正确

**禁止事项**:
- 禁止允许绕过限流

**依赖项**:
- Redis 测试环境已配置
- 时间模拟工具已安装

---

## 任务5:权限测试

**产出物**:
- `tests/integration/permission.test.js`

**执行内容**:

### 5.1 测试场景:套餐权限
```javascript
describe('套餐权限测试', () => {
  it('基础会员不能使用 PRO 功能', async () => {
    const user = await createTestUser({ 
      membership_level: '基础', 
      quota_remaining: 100 
    });
    const token = await loginUser(user);
    
    // 获取功能列表
    const features = await request(app)
      .get('/api/features')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    // PRO 功能不应该出现在列表中
    const proFeature = features.body.features.find(f => f.feature_id === 'model_pose12');
    expect(proFeature).toBeUndefined();
    
    // 直接请求 PRO 功能应该返回 403
    await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'model_pose12',
        input_data: { garmentImage: 'https://test.jpg' }
      })
      .expect(403);
  });
  
  it('PRO 会员可以使用基础功能和 PRO 功能', async () => {
    const user = await createTestUser({ 
      membership_level: 'PRO', 
      quota_remaining: 100 
    });
    const token = await loginUser(user);
    
    // 基础功能可用
    await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'basic_clean',
        input_data: { productImage: 'https://test.jpg' }
      })
      .expect(200);
    
    // PRO 功能也可用
    await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        feature_id: 'model_pose12',
        input_data: { garmentImage: 'https://test.jpg' }
      })
      .expect(200);
  });
});
```

### 5.2 测试场景:白名单权限
```javascript
describe('白名单权限测试', () => {
  it('只有白名单用户能使用白名单功能', async () => {
    // 创建白名单功能
    await db('feature_definitions').insert({
      feature_id: 'beta_feature',
      access_scope: 'whitelist',
      allowed_accounts: JSON.stringify([123, 456]),
      is_enabled: true,
      // ... 其他字段
    });
    
    // 白名单内用户
    const whitelistUser = await createTestUser({ id: 123, quota_remaining: 100 });
    const whitelistToken = await loginUser(whitelistUser);
    
    const features1 = await request(app)
      .get('/api/features')
      .set('Authorization', `Bearer ${whitelistToken}`)
      .expect(200);
    
    expect(features1.body.features.find(f => f.feature_id === 'beta_feature')).toBeDefined();
    
    // 白名单外用户
    const normalUser = await createTestUser({ id: 789, quota_remaining: 100 });
    const normalToken = await loginUser(normalUser);
    
    const features2 = await request(app)
      .get('/api/features')
      .set('Authorization', `Bearer ${normalToken}`)
      .expect(200);
    
    expect(features2.body.features.find(f => f.feature_id === 'beta_feature')).toBeUndefined();
  });
});
```

**验收标准**:
- 套餐权限正确过滤
- 白名单功能只对指定用户可见
- 权限不足时返回 403

**禁止事项**:
- 禁止在前端判断权限

**依赖项**:
- 测试用户数据已准备

---

## 任务6:性能测试

**产出物**:
- `tests/performance/concurrency.test.js`

**执行内容**:

### 6.1 并发配额扣减测试
```javascript
describe('并发性能测试', () => {
  it('100 个并发请求同时扣费,配额总数应该正确', async () => {
    const user = await createTestUser({ quota_remaining: 1000 });
    const token = await loginUser(user);
    
    // 并发 100 个请求
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        request(app)
          .post('/api/tasks/create')
          .set('Authorization', `Bearer ${token}`)
          .send({
            feature_id: 'basic_clean', // quota_cost=1
            input_data: { productImage: `https://test${i}.jpg` }
          })
      );
    }
    
    const results = await Promise.all(promises);
    
    // 所有请求都应该成功
    results.forEach(res => {
      expect(res.status).toBe(200);
    });
    
    // 配额应该正好扣减 100
    const userAfter = await db('users').where({ id: user.id }).first();
    expect(userAfter.quota_remaining).toBe(900);
  });
});
```

**验收标准**:
- 并发 100 个请求,配额总数正确
- 无超扣或少扣
- 响应时间在可接受范围内(P95 < 500ms)

**禁止事项**:
- 禁止在性能测试中使用真实供应商

**依赖项**:
- 数据库连接池已配置

---

## 依赖规范

### 测试环境
1. **数据库隔离**: 使用独立的测试数据库,不影响生产环境
2. **Mock 供应商**: 所有外部 API 调用都使用 mock,不真实调用
3. **Redis 隔离**: 使用独立的 Redis db

### 人工验收标准
1. **质量标准**: 生成结果必须达到可售卖标准
2. **抽样次数**: 至少 3 次成功案例
3. **失败场景**: 必须测试失败返配额
4. **上线决策**: 验收通过后才能设置 is_enabled=true

### 自动化测试标准
1. **覆盖率**: 集成测试覆盖 3 个完整功能流程
2. **失败场景**: 必须测试配额返还
3. **权限场景**: 必须测试套餐权限和白名单
4. **并发场景**: 必须测试 100 并发配额扣减

### 禁止事项
1. **禁止运行时自动质检**: 质检只在上线前人工做
2. **禁止基于画质自动返配额**: 只基于技术失败返还
3. **禁止跳过人工验收**: is_enabled=true 之前必须人工测试

### 交付标准
- 人工验收报告(包含截图)
- 集成测试全部通过
- 性能测试通过
- 测试覆盖率 > 80%
