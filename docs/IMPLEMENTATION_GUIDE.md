# 服装AI处理 SaaS 平台 - 实施指南

## 📋 项目概览

**核心业务**: 提供服装图片AI处理服务(基础修图+AI模特上身)
**商业模式**: 单月会员制(¥99/月获得100次生成配额)
**技术架构**: 全栈SaaS应用(前端+后端+第三方服务编排)

---

## 🎯 关键约束与原则

### 1. 第一条可跑通链路约束 (关键!)

> **支付对接 / 会员开通 / 配额扣减-返还 / 任务创建(basic_clean & model_pose12)** 必须在**同一迭代内同时联调通过**,否则没有可展示/可收费的闭环。

**执行要求**:
- PM、后端、前端、支付同学必须在同一迭代周期内完成
- 每日站会确认接口对接进度
- 不能各做各的,最后发现链路断了

### 2. 配额管理核心约束

**NON-NEGATIVE GUARANTEE**: 配额扣减必须是事务/行锁级别
- ✅ 使用数据库事务或行锁(如 `SELECT ... FOR UPDATE`)
- ❌ 禁止非原子操作(如 `quota = quota - 1` 的读-改-写)
- ✅ 任务创建时立即预扣1次
- ✅ 失败时自动返还配额

### 3. RunningHub 查询约束

**防止无限次打第三方服务**:
- ✅ 仅当本地状态为 `processing` 且类型为 `model_pose12` 时查询
- ✅ 一旦拿到 SUCCESS/FAIL,必须在本地落库为 done/failed
- ✅ 后续所有 `GET /task/:id` 请求直接返回本地数据
- ❌ 不能在每次前端轮询时都打 RunningHub

### 4. 配额值配置化

**不要硬编码常量**:
- ✅ 使用环境变量 `PLAN_MONTHLY_QUOTA=100`
- ✅ 或配置表字段,便于后续调价
- ❌ 不要在代码里写死 `quota = 100`

---

## 🏗️ 技术架构概览

```
┌─────────────┐
│  Web前端    │ (React/Next.js)
│  工作台界面  │
└──────┬──────┘
       │
       ├─────────┐
       │         │
┌──────▼──────┐  │
│  后端API    │  │ COS直传
│  服务编排    │  │ (STS临时密钥)
└──────┬──────┘  │
       │         │
       ├─────────┴───────┐
       │                 │
┌──────▼──────┐   ┌──────▼──────┐
│ 腾讯数据万象 │   │ RunningHub │
│ (同步处理)   │   │ (异步工作流) │
└─────────────┘   └─────────────┘
       │                 │
       └────────┬────────┘
                ▼
        ┌───────────────┐
        │  腾讯云 COS    │
        │  对象存储      │
        └───────────────┘
```

---

## 📂 数据库设计要点

### users 表 (用户与会员)

```sql
CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  phone VARCHAR(11) UNIQUE NOT NULL,
  isMember BOOLEAN DEFAULT false,
  quota_remaining INT DEFAULT 0,  -- 必须保证非负
  quota_expireAt DATETIME NULL,   -- 到期时间
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_phone (phone)
);
```

### orders 表 (订单)

```sql
CREATE TABLE orders (
  id VARCHAR(32) PRIMARY KEY,
  userId VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL,  -- pending/paid/failed
  amount DECIMAL(10,2) NOT NULL,
  channel VARCHAR(20) NOT NULL,  -- wx/alipay
  transactionId VARCHAR(64) UNIQUE NULL,  -- 幂等性保证
  createdAt DATETIME NOT NULL,
  paidAt DATETIME NULL,
  INDEX idx_userId (userId),
  INDEX idx_userId_status (userId, status)
);
```

### tasks 表 (任务)

```sql
CREATE TABLE tasks (
  id VARCHAR(32) PRIMARY KEY,
  userId VARCHAR(32) NOT NULL,
  type VARCHAR(20) NOT NULL,  -- basic_clean/model_pose12
  status VARCHAR(20) NOT NULL,  -- processing/done/failed
  inputUrl TEXT NOT NULL,
  resultUrls JSON NULL,  -- 必须存COS链接,不能存RunningHub临时URL
  vendorTaskId VARCHAR(64) NULL,
  params JSON NULL,
  errorReason TEXT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_userId_createdAt (userId, createdAt DESC),
  INDEX idx_vendorTaskId (vendorTaskId)
);
```

---

## 🔐 环境变量配置清单

创建 `.env` 文件:

```bash
# 数据库
DATABASE_URL=mysql://user:password@localhost:3306/ai_photo
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# JWT密钥
JWT_SECRET=your_random_secret_key_here
JWT_EXPIRE=7d

# 腾讯云COS
TENCENT_SECRET_ID=AKIDWxogYJsGRXVKAreFftFRTK82rXFpCQSJ
TENCENT_SECRET_KEY=wgDXjlbEhElBNdpunW6UfeS4UjnfKn37
TENCENT_APPID=1379020062
COS_BUCKET=ai-photo-prod-1379020062
COS_REGION=ap-guangzhou
COS_IMAGE_DOMAIN=ai-photo-prod-1379020062.picgz.myqcloud.com

# 配额配置
PLAN_MONTHLY_QUOTA=100  # 单月会员配额
MEMBERSHIP_PRICE=9900   # 价格(分)

# RunningHub
RUNNINGHUB_API_KEY=your_runninghub_api_key
RUNNINGHUB_WEBAPP_ID=your_webapp_id
RUNNINGHUB_TIMEOUT=600000  # 10分钟超时

# 支付渠道(选择微信或支付宝)
PAYMENT_CHANNEL=wx  # wx/alipay
WECHAT_MCHID=your_merchant_id
WECHAT_API_KEY=your_wechat_api_key
WECHAT_CERT_PATH=/path/to/cert.pem

# 短信验证码
SMS_PROVIDER=tencent  # 腾讯云短信
SMS_APP_ID=your_sms_app_id
SMS_APP_KEY=your_sms_app_key
SMS_TEMPLATE_ID=your_template_id

# 内容审核
AUDIT_ENABLED=true
AUDIT_THRESHOLD=0.8  # 置信度阈值

# 服务器
PORT=3000
NODE_ENV=production
API_DOMAIN=https://api.aizhao.icu
```

---

## 🔄 核心业务流程实现要点

### 流程1: 会员购买闭环

```javascript
// POST /membership/purchase
async function purchaseMembership(userId, channel) {
  // 1. 创建订单(status=pending)
  const order = await createOrder({
    userId,
    amount: process.env.MEMBERSHIP_PRICE, // 9900分
    channel,
    status: 'pending'
  });

  // 2. 调用支付渠道
  const payParams = await getPaymentParams(order);

  // 3. 返回支付参数给前端
  return { orderId: order.id, payParams };
}

// POST /membership/payment-callback (支付回调)
async function handlePaymentCallback(callbackData) {
  // 1. 验证签名(防篡改)
  if (!verifySignature(callbackData)) {
    throw new Error('Invalid signature');
  }

  // 2. 查询订单
  const order = await getOrder(callbackData.orderId);
  
  // 3. 幂等性检查
  if (order.status === 'paid') {
    return { success: true }; // 已处理,直接返回
  }

  // 4. 开启事务
  await transaction(async (trx) => {
    // 更新订单状态
    await trx('orders').where({ id: order.id }).update({
      status: 'paid',
      transactionId: callbackData.transactionId,
      paidAt: new Date()
    });

    // 开通会员(关键逻辑)
    const quota = parseInt(process.env.PLAN_MONTHLY_QUOTA); // 100
    await trx('users').where({ id: order.userId }).update({
      isMember: true,
      quota_remaining: quota,
      quota_expireAt: new Date(Date.now() + 30 * 24 * 3600 * 1000)
    });
  });

  return { success: true };
}
```

### 流程2: 配额扣减与返还

```javascript
// 任务创建时预扣配额(使用行锁)
async function deductQuota(userId) {
  return await transaction(async (trx) => {
    // 1. 加行锁查询
    const user = await trx('users')
      .where({ id: userId })
      .forUpdate()  // 行锁,防止并发
      .first();

    // 2. 检查会员状态
    if (!user.isMember || user.quota_remaining <= 0) {
      throw new Error('配额不足');
    }

    // 3. 原子扣减
    await trx('users')
      .where({ id: userId })
      .decrement('quota_remaining', 1);

    return true;
  });
}

// 任务失败时返还配额
async function refundQuota(userId, taskId) {
  await transaction(async (trx) => {
    // 1. 标记任务失败
    await trx('tasks').where({ id: taskId }).update({
      status: 'failed',
      updatedAt: new Date()
    });

    // 2. 返还配额
    await trx('users')
      .where({ id: userId })
      .increment('quota_remaining', 1);

    // 3. 记录日志
    await trx('quota_logs').insert({
      userId,
      taskId,
      action: 'refund',
      amount: 1,
      createdAt: new Date()
    });
  });
}
```

### 流程3: RunningHub 异步任务处理

```javascript
// POST /task/create (type=model_pose12)
async function createModelPose12Task(userId, inputUrl, params) {
  // 1. 扣减配额
  await deductQuota(userId);

  // 2. 创建任务记录
  const taskId = generateId();
  await createTask({
    id: taskId,
    userId,
    type: 'model_pose12',
    status: 'processing',
    inputUrl,
    params
  });

  // 3. 构建12分镜Prompt
  const prompt = buildPrompt(params.scene, params.category);
  const seed = Math.floor(Math.random() * 2147483647);

  // 4. 生成COS签名URL(用于传参考图)
  const signedUrl = generateCOSSignedUrl(inputUrl, 3600); // 1小时有效

  // 5. 调用RunningHub
  const result = await runningHubAPI.run({
    webappId: process.env.RUNNINGHUB_WEBAPP_ID,
    nodeInfoList: [
      { nodeId: 'prompt_node', fieldName: 'prompt', fieldValue: prompt },
      { nodeId: 'image_node', fieldName: 'image', fieldValue: signedUrl },
      { nodeId: 'seed_node', fieldName: 'seed', fieldValue: seed }
    ]
  });

  // 6. 保存vendorTaskId
  await updateTask(taskId, {
    vendorTaskId: result.taskId
  });

  return { taskId };
}

// GET /task/:taskId (轮询查询)
async function getTaskStatus(taskId) {
  // 1. 查询本地任务
  const task = await getTask(taskId);

  // 2. 如果已终结,直接返回本地数据(关键约束!)
  if (task.status === 'done' || task.status === 'failed') {
    return task; // 不再查RunningHub
  }

  // 3. 如果是processing + model_pose12,才查RunningHub
  if (task.status === 'processing' && task.type === 'model_pose12') {
    const rhStatus = await runningHubAPI.getStatus(task.vendorTaskId);

    if (rhStatus.status === 'SUCCESS') {
      // 4. 拉取结果并保存到COS
      const outputs = await runningHubAPI.getOutputs(task.vendorTaskId);
      const resultUrls = await downloadAndSaveToCOS(outputs, task.userId, taskId);

      // 5. 一次性落库(关键!)
      await updateTask(taskId, {
        status: 'done',
        resultUrls,
        updatedAt: new Date()
      });

      task.status = 'done';
      task.resultUrls = resultUrls;
    } else if (rhStatus.status === 'FAIL') {
      // 6. 失败处理
      await refundQuota(task.userId, taskId);
      task.status = 'failed';
      task.errorReason = rhStatus.message;
    }
  }

  return task;
}

// Prompt模板(商业IP,不暴露给前端)
function buildPrompt(scene, category) {
  const sceneMap = {
    street: 'urban street photography, natural lighting',
    studio: 'professional studio photography, clean white background',
    indoor: 'cozy indoor setting, warm lighting'
  };

  const categoryMap = {
    shoes: 'fashion shoes on model',
    dress: 'elegant dress on model',
    hoodie: 'casual hoodie on model',
    coat: 'stylish coat on model'
  };

  return `
${sceneMap[scene]}, professional fashion photography,
${categoryMap[category]},
12 different poses and angles: 
front view, side view, back view, 3/4 view,
walking, standing, sitting, dynamic poses,
commercial quality, high resolution, 8k
  `.trim();
}
```

### 流程4: 腾讯数据万象基础修图

```javascript
// POST /task/create (type=basic_clean)
async function createBasicCleanTask(userId, inputUrl, params) {
  // 1. 扣减配额
  await deductQuota(userId);

  // 2. 创建任务记录
  const taskId = generateId();
  await createTask({
    id: taskId,
    userId,
    type: 'basic_clean',
    status: 'processing',
    inputUrl,
    params
  });

  // 3. 构建数据万象处理规则
  const outputPath = `/output/${userId}/${taskId}/result.jpg`;
  
  // 使用Pic-Operations机制
  const picOperations = {
    is_pic_info: 1,
    rules: [{
      fileid: outputPath,
      rule: 'imageMogr2/auto-orient' + // 自动旋转
            '|imageView2/1/w/800/h/800/q/90' + // 等比缩放
            '|GoodsMatting' + // 商品抠图
            '|watermark/1/image/...' // 可选:增强效果
    }]
  };

  // 4. 调用数据万象(同步处理)
  const result = await ciAPI.process({
    bucket: process.env.COS_BUCKET,
    region: process.env.COS_REGION,
    key: inputUrl,
    picOperations: JSON.stringify(picOperations)
  });

  // 5. 更新任务状态
  const resultUrl = `https://${process.env.COS_IMAGE_DOMAIN}${outputPath}`;
  await updateTask(taskId, {
    status: 'done',
    resultUrls: [resultUrl],
    updatedAt: new Date()
  });

  return { taskId };
}
```

---

## 🎨 前端实现要点

### 1. STS临时密钥 + COS直传

```javascript
// 图片上传组件
async function uploadImage(file, taskId) {
  // 1. 获取STS临时密钥
  const { credentials, bucket, region, allowPrefix } = await api.getSTS(taskId);

  // 2. 初始化COS客户端
  const cos = new COS({
    getAuthorization: (options, callback) => {
      callback({
        TmpSecretId: credentials.tmpSecretId,
        TmpSecretKey: credentials.tmpSecretKey,
        SecurityToken: credentials.sessionToken,
        ExpiredTime: credentials.expiredTime
      });
    }
  });

  // 3. 直传到COS
  const key = `${allowPrefix}/${file.name}`;
  const result = await cos.putObject({
    Bucket: bucket,
    Region: region,
    Key: key,
    Body: file
  });

  return { url: `/${key}`, location: result.Location };
}
```

### 2. 支付状态轮询

```javascript
// 会员购买页面
async function handlePurchase() {
  // 1. 创建订单
  const { orderId, payParams } = await api.purchaseMembership('wx');

  // 2. 拉起支付
  await wechatPay.invoke(payParams);

  // 3. 进入等待页面,开始轮询
  setIsPolling(true);
  const timer = setInterval(async () => {
    const status = await api.getMembershipStatus();
    
    if (status.isMember) {
      clearInterval(timer);
      message.success('会员开通成功!');
      router.push('/workspace');
    }
  }, 2000); // 每2秒轮询一次

  // 4. 30秒后超时
  setTimeout(() => {
    if (isPolling) {
      clearInterval(timer);
      message.warning('支付确认中,请稍后刷新页面');
    }
  }, 30000);
}
```

### 3. 任务详情页轮询

```javascript
// 任务详情页
function TaskDetailPage({ taskId }) {
  const [task, setTask] = useState(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!isPolling) return;

    const timer = setInterval(async () => {
      const data = await api.getTask(taskId);
      setTask(data);

      // 任务终结,停止轮询
      if (data.status === 'done' || data.status === 'failed') {
        setIsPolling(false);
        clearInterval(timer);
      }
    }, 3000); // 每3秒轮询

    return () => clearInterval(timer);
  }, [taskId, isPolling]);

  return (
    <div>
      {task?.status === 'processing' && <ProgressBar />}
      {task?.status === 'done' && <ImageGrid urls={task.resultUrls} />}
      {task?.status === 'failed' && (
        <ErrorPanel 
          message={task.errorReason} 
          onRetry={() => retryTask(task)} 
        />
      )}
    </div>
  );
}
```

---

## 🧪 测试检查清单

### 第一条闭环验收(必须通过)

- [ ] 用户注册登录成功
- [ ] 会员购买→支付回调→配额到账(100次)
- [ ] 工作台显示:会员状态、剩余次数、到期时间
- [ ] 创建basic_clean任务→扣1次→生成成功
- [ ] 创建model_pose12任务→扣1次→生成12张图
- [ ] 任务失败→配额自动返还

### 配额管理测试

- [ ] 并发创建10个任务,配额正确扣减10次
- [ ] quota_remaining=0时,创建任务被拒绝
- [ ] 会员到期后,isMember自动变false
- [ ] 配额不会出现负数

### RunningHub集成测试

- [ ] 任务创建成功返回taskId
- [ ] 轮询查询显示processing状态
- [ ] SUCCESS后拉取12张图并保存到COS
- [ ] FAIL后标记failed并返还配额
- [ ] 10分钟超时后自动标记失败
- [ ] done/failed后不再查询RunningHub

### 支付集成测试

- [ ] 支付成功→回调处理→会员开通
- [ ] 重复回调→幂等性保证,不重复处理
- [ ] 签名验证失败→拒绝处理
- [ ] 前端轮询能正确识别支付成功

---

## 📦 部署清单

### 服务器配置
- IP: 43.139.187.166
- 域名: api.aizhao.icu
- 数据库: root / 密码7236e7b4b31ebc7e
- 宝塔面板已安装

### 部署步骤

1. **环境准备**
   ```bash
   # 安装Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 安装PM2
   npm install -g pm2
   ```

2. **代码部署**
   ```bash
   # 上传代码到服务器
   scp -r ./backend root@43.139.187.166:/var/www/ai-photo-backend
   
   # 安装依赖
   cd /var/www/ai-photo-backend
   npm install --production
   ```

3. **配置环境变量**
   ```bash
   # 创建.env文件
   vim .env
   # 复制上述环境变量配置
   ```

4. **数据库初始化**
   ```bash
   # 运行迁移脚本
   npm run db:migrate
   ```

5. **启动服务**
   ```bash
   # 使用PM2启动
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

6. **配置Nginx反向代理**
   ```nginx
   server {
       listen 80;
       server_name api.aizhao.icu;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

7. **配置SSL证书**
   ```bash
   # 使用Let's Encrypt
   sudo certbot --nginx -d api.aizhao.icu
   ```

---

## 🚨 常见问题与解决方案

### Q1: 配额出现负数怎么办?
**A**: 必须使用数据库事务+行锁,参考上述 `deductQuota` 实现。

### Q2: RunningHub 查询次数过多导致成本增加?
**A**: 严格遵守"一次性落库"原则,done/failed后不再查询外部服务。

### Q3: 支付回调丢失,用户付款但未开通会员?
**A**: 实现主动查询订单状态接口,用户可手动"刷新支付状态"。

### Q4: COS 直传失败?
**A**: 检查STS权限策略,确保allowPrefix与实际上传路径一致。

### Q5: 会员到期后如何处理?
**A**: 在 `GET /membership/status` 接口检查,发现过期后一次性降级(设置isMember=false)。

---

## 📞 联系方式

- **项目管理**: [待填写]
- **后端负责人**: [待填写]
- **前端负责人**: [待填写]
- **运维负责人**: [待填写]

---

## 📅 里程碑时间表

| 阶段 | 内容 | 预计完成时间 |
|------|------|-------------|
| 第一阶段 | 基础架构搭建 | Day 1-3 |
| 第二阶段 | 认证与会员核心链路 | Day 4-8 |
| 第三阶段 | 配额管理与媒体服务 | Day 9-11 |
| 第四阶段 | 基础修图任务流程 | Day 12-15 |
| 第五阶段 | AI模特生成任务流程 | Day 16-20 |
| 第六阶段 | 内容审核与任务管理 | Day 21-23 |
| 第七阶段 | 管理后台 | Day 24-25 |
| 第八阶段 | 集成测试与上线 | Day 26-30 |

**目标上线时间**: 30个工作日内完成MVP

---

## ✅ MVP 验收标准

### 功能验收(必须全部通过)

1. ✅ 用户注册登录(手机号+验证码)
2. ✅ 会员购买(支付成功→配额到账100次)
3. ✅ 会员状态展示(剩余次数+到期时间)
4. ✅ 基础修图功能(上传→生成白底主图→扣1次)
5. ✅ AI模特生成功能(上传→12张分镜→扣1次)
6. ✅ 任务详情页(状态+进度+结果展示)
7. ✅ 结果下载(逐张下载,批量下载为后续增强项)
8. ✅ 失败处理(配额自动返还)
9. ✅ 到期检查(会员到期自动失效)
10. ✅ 管理后台(用户/任务查询)

### 性能验收

- 基础修图响应时间: < 5秒(P95)
- AI模特生成时间: < 3分钟(P95)
- 任务列表加载: < 1秒
- 支付回调处理: < 2秒
- STS获取响应: < 500ms

### 安全验收

- STS权限隔离正确
- 支付签名验证通过
- API密钥不泄露
- 用户数据隔离验证
- 频率限制生效

---

**文档版本**: v1.0  
**最后更新**: 2025-10-28  
**文档所有者**: AI照项目组
