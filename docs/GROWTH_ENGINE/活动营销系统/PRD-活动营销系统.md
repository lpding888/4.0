# 产品需求文档：活动营销系统

> **Product Planner Skill 标准输出**
> **创建日期**：2025-10-29
> **版本**：v1.0
> **状态**：待开发

---

## 1. 需求背景 / 目标

### 这个功能为什么做
- **商业问题**：当前平台只有固定价格的会员制（¥99/月），缺乏灵活的营销手段来吸引新用户、促活老用户
- **用户痛点**：用户无法享受到节日促销、新人优惠等福利，导致转化率低、复购意愿不强
- **市场竞争**：竞品普遍有优惠券、限时折扣等营销工具，我们需要跟上

### 目标用户是谁
- **主要用户**：新注册用户（需要新人优惠刺激购买）
- **次要用户**：即将到期的会员（需要续费优惠刺激复购）
- **运营人员**：需要后台工具来创建和管理各种营销活动

### 商业价值
- **提升转化率**：新人首购优惠预计提升15-25%转化
- **增加复购**：老用户续费折扣预计提升10-15%复购率
- **灵活定价**：可根据节日、库存、竞争情况动态调整价格策略
- **用户增长**：通过优惠活动吸引更多用户注册和付费

---

## 2. 用户完整使用流程

### 2.1 用户侧流程（领取和使用优惠券）

**路径A：新人注册送券**
1. 用户完成手机号注册登录
2. 系统自动检测是否为新用户
3. 如果是新用户且有"新人券"活动，自动发放优惠券到账户
4. 前端弹出胶囊提示："恭喜！新人专属优惠券已到账"
5. 用户点击"立即使用"跳转到会员购买页

**路径B：用户主动领券**
1. 用户登录后在工作台看到"优惠活动"入口卡片
2. 点击进入 `/promotions` 活动列表页
3. 看到多个活动卡片（双十一特惠、限时折扣等）
4. 点击某个活动的"立即领取"按钮
5. 系统校验：是否已领取、是否符合条件、是否达到领取上限
6. 领取成功，前端toast提示"领取成功！购买时自动抵扣"
7. 用户点击"去使用"跳转到会员购买页

**路径C：购买时使用优惠券**
1. 用户进入 `/membership/buy` 会员购买页
2. 页面显示原价 ¥99
3. 下方显示"可用优惠券"区域：
   - 列出用户所有未过期、未使用的优惠券
   - 显示每张券的面额、有效期、使用条件
4. 用户点选一张优惠券（单选）
5. 实时计算折后价，例如 ¥99 - ¥20 = ¥79
6. 用户点击"支付 ¥79"按钮
7. 调用 `POST /orders/create` 时传入 `couponId`
8. 后端校验优惠券有效性，生成订单
9. 跳转微信支付
10. 支付成功后，优惠券状态变更为"已使用"

### 2.2 管理员流程（创建和管理活动）

**路径D：管理员创建优惠活动**
1. 管理员登录后台 `/admin`
2. 左侧菜单点击"活动管理"
3. 进入 `/admin/promotions` 活动列表页
4. 点击"创建活动"按钮
5. 进入表单页 `/admin/promotions/new`，填写：
   - 活动名称：例如"双十一特惠"
   - 活动类型：优惠券 / 折扣码
   - 优惠金额：固定金额（¥20）或百分比（8折）
   - 有效期：开始时间 / 结束时间
   - 发放规则：新人自动发放 / 用户手动领取
   - 使用条件：订单满¥99可用
   - 发放上限：总数1000张 / 每人限领1张
6. 点击"创建"提交
7. 后端创建活动并生成优惠券池
8. 前端跳回列表页，显示新创建的活动

**路径E：管理员查看活动数据**
1. 在 `/admin/promotions` 列表页
2. 每个活动卡片显示：
   - 活动名称 / 类型 / 状态（进行中/已结束）
   - 已领取数量 / 总数量
   - 已使用数量 / 核销率
   - 带来的GMV
3. 点击某个活动的"查看详情"
4. 进入 `/admin/promotions/:id` 详情页
5. 看到：
   - 领券用户列表（姓名、手机号、领取时间）
   - 核销记录（订单号、使用时间、抵扣金额）
   - 数据图表（领取趋势、核销趋势）

**路径F：管理员下线活动**
1. 在活动列表页点击某个活动的"下线"按钮
2. 弹出二次确认："确认下线？已领取未使用的券不受影响"
3. 确认后，后端更新活动状态为"已下线"
4. 前端该活动卡片显示"已下线"标签
5. 用户端不再显示该活动，但已领取的券仍可使用

### 2.3 异常情况处理

**异常A：优惠券已领完**
- 用户点击"领取"时，后端校验库存为0
- 返回错误：`{ code: 40001, message: "优惠券已抢光" }`
- 前端显示红色toast："抱歉，优惠券已被领光"
- 按钮变灰显示"已抢光"

**异常B：优惠券已过期**
- 用户购买时选择了已过期的券
- 后端校验 `expireAt < now`
- 返回错误：`{ code: 40002, message: "优惠券已过期" }`
- 前端移除该券选项，toast提示"该券已过期，请选择其他券"

**异常C：优惠券不满足使用条件**
- 例如：订单满¥199可用，但用户购买的是¥99套餐
- 后端校验 `orderAmount < minAmount`
- 返回错误：`{ code: 40003, message: "订单金额不满足使用条件" }`
- 前端该券显示为灰色不可选，tooltip提示条件

**异常D：重复领取**
- 用户尝试再次领取已领过的券
- 后端校验 `user_coupons` 表已存在记录
- 返回错误：`{ code: 40004, message: "您已领取过该券" }`
- 前端按钮显示"已领取"，不可再点击

---

## 3. 页面级需求（交给 frontend_dev_skill）

### 3.1 用户端页面

#### 页面1：活动列表页 `/promotions`
- **入口**：工作台新增"优惠活动"功能卡片
- **页面布局**：
  - 深色渐变背景（蓝黑→墨绿），遵循品牌高奢风
  - 标题："限时优惠活动"（大而轻的标题）
  - 活动卡片列表（竖向滚动）
- **活动卡片设计**：
  - 半透明玻璃卡片
  - 左侧：活动图标/徽章（HOT标签、NEW标签）
  - 中间：活动名称、优惠金额、有效期、使用条件
  - 右侧：CTA按钮
    - 未领取："立即领取"（霓虹青边按钮）
    - 已领取："已领取"（灰色禁用）
    - 已抢光："已抢光"（灰色禁用）
- **接口调用**：
  - `GET /promotions/list` 获取活动列表
  - `POST /promotions/:id/claim` 领取优惠券

#### 页面2：会员购买页（改造） `/membership/buy`
- **新增区域**："可用优惠券"
  - 位置：在原价下方，支付按钮上方
  - 设计：
    - 优惠券选择器（单选）
    - 每张券显示：面额、有效期、使用条件
    - 选中后实时计算折后价
    - 折扣金额用醒目颜色标红："-¥20"
- **价格计算**：
  - 原价：¥99（浅灰色小字）
  - 折后价：¥79（大而亮的主色调数字）
- **按钮状态**：
  - 未选券："支付 ¥99"
  - 选券后："支付 ¥79（已优惠¥20）"
- **接口调用**：
  - `GET /coupons/my` 获取用户可用优惠券
  - `POST /orders/create` 创建订单时传入 `couponId`

#### 页面3：我的优惠券页（新建） `/coupons/my`
- **入口**：个人中心新增"我的优惠券"菜单项
- **页面布局**：
  - Tab切换：未使用 / 已使用 / 已过期
  - 优惠券卡片列表
- **优惠券卡片设计**：
  - 仿真券样式（左侧齿轮边、右侧金额大字）
  - 显示：面额、有效期、使用条件、状态
  - 未使用的券：显示"去使用"按钮
  - 已使用的券：显示灰色"已使用"标签
  - 已过期的券：整张卡片灰化
- **接口调用**：
  - `GET /coupons/my?status=unused` 获取优惠券列表

### 3.2 管理员端页面

#### 页面4：活动管理列表 `/admin/promotions`
- **入口**：管理后台左侧菜单新增"活动管理"
- **页面布局**：
  - 顶部："创建活动"按钮
  - 搜索栏：按活动名称、状态筛选
  - 活动表格：
    - 列：活动名称、类型、优惠金额、有效期、状态、已领取/总数、核销率、操作
    - 操作列：查看详情 / 编辑 / 下线
  - 分页器
- **接口调用**：
  - `GET /admin/promotions?limit=20&offset=0` 获取活动列表

#### 页面5：创建/编辑活动 `/admin/promotions/new` 或 `/admin/promotions/:id/edit`
- **页面布局**：
  - 表单面板（遵循管理后台一致风格）
  - 字段：
    - 活动名称（必填）
    - 活动类型（下拉：优惠券 / 折扣码）
    - 优惠方式（单选：固定金额 / 百分比折扣）
    - 优惠金额（数字输入，例如20表示¥20或8表示8折）
    - 有效期（日期时间选择器：开始时间 / 结束时间）
    - 发放规则（单选：新人自动发放 / 用户手动领取）
    - 使用条件（数字输入：订单满X元可用）
    - 发放上限（数字输入：总数量 / 每人限领数量）
  - 底部：保存 / 取消按钮
- **接口调用**：
  - `POST /admin/promotions` 创建活动
  - `PUT /admin/promotions/:id` 更新活动

#### 页面6：活动详情 `/admin/promotions/:id`
- **页面布局**：
  - 顶部：活动基本信息卡片
  - 数据统计卡片：
    - 已领取数量 / 已使用数量 / 核销率 / 带来GMV
  - Tab切换：领券记录 / 核销记录
  - 表格：
    - 领券记录：用户ID、手机号、领取时间
    - 核销记录：订单号、用户、使用时间、抵扣金额
  - 数据图表：领取趋势、核销趋势
- **接口调用**：
  - `GET /admin/promotions/:id` 获取活动详情
  - `GET /admin/promotions/:id/claims` 获取领券记录
  - `GET /admin/promotions/:id/usages` 获取核销记录

### 3.3 前端禁止事项
- ❌ 不允许前端本地计算折后价（必须由后端校验并计算）
- ❌ 不允许前端伪造 `couponId` 绕过校验
- ❌ 不允许显示内部优惠券ID或敏感信息
- ❌ 不允许前端修改优惠券状态（必须通过后端接口）

---

## 4. 后端接口需求（交给 backend_dev_skill）

### 4.1 用户端接口

#### 接口1：获取活动列表
```
GET /promotions/list
```
**Query参数**：
- `status` (optional): `active` | `ended` （默认只返回active）
- `limit` (optional): 每页数量，默认20
- `offset` (optional): 偏移量，默认0

**响应结构**：
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "id": "promo_123",
        "name": "双十一特惠",
        "type": "coupon",
        "discountType": "fixed_amount",
        "discountValue": 20,
        "startAt": "2025-11-01T00:00:00Z",
        "endAt": "2025-11-11T23:59:59Z",
        "minOrderAmount": 99,
        "totalQuota": 1000,
        "claimedCount": 856,
        "maxPerUser": 1,
        "userClaimedStatus": "not_claimed" | "claimed" | "sold_out"
      }
    ],
    "total": 10
  }
}
```

#### 接口2：领取优惠券
```
POST /promotions/:id/claim
```
**请求体**：无

**响应结构**：
```json
{
  "success": true,
  "data": {
    "couponId": "coupon_abc123",
    "message": "领取成功！"
  }
}
```

**错误码**：
- `40001`: 优惠券已抢光
- `40004`: 您已领取过该券
- `40005`: 活动未开始或已结束
- `40006`: 不符合领取条件

#### 接口3：获取用户优惠券列表
```
GET /coupons/my
```
**Query参数**：
- `status` (optional): `unused` | `used` | `expired` （默认unused）
- `limit` (optional): 每页数量，默认20
- `offset` (optional): 偏移量，默认0

**响应结构**：
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "id": "coupon_abc123",
        "promotionName": "双十一特惠",
        "discountType": "fixed_amount",
        "discountValue": 20,
        "minOrderAmount": 99,
        "status": "unused",
        "claimedAt": "2025-11-01T10:00:00Z",
        "expireAt": "2025-11-11T23:59:59Z"
      }
    ],
    "total": 5
  }
}
```

#### 接口4：创建订单（改造）
```
POST /orders/create
```
**请求体新增字段**：
```json
{
  "planType": "monthly",
  "couponId": "coupon_abc123"  // 新增：使用的优惠券ID（可选）
}
```

**响应结构**：
```json
{
  "success": true,
  "data": {
    "orderId": "order_xyz",
    "originalAmount": 99,
    "discountAmount": 20,  // 新增：优惠金额
    "finalAmount": 79,     // 新增：实付金额
    "paymentUrl": "weixin://..."
  }
}
```

**后端逻辑变更**：
1. 接收 `couponId` 参数
2. 校验优惠券有效性：
   - 是否存在
   - 是否属于该用户
   - 是否已使用
   - 是否已过期
   - 订单金额是否满足使用条件
3. 计算折后价
4. 创建订单时记录 `couponId` 和折扣金额
5. 生成微信支付订单（金额为折后价）
6. 支付成功回调时，更新优惠券状态为"已使用"

### 4.2 管理员端接口

#### 接口5：获取活动列表（管理员）
```
GET /admin/promotions
```
**Query参数**：
- `status` (optional): `active` | `ended` | `offline`
- `keyword` (optional): 活动名称关键词
- `limit` (optional): 每页数量，默认20
- `offset` (optional): 偏移量，默认0

**响应结构**：
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "id": "promo_123",
        "name": "双十一特惠",
        "type": "coupon",
        "discountType": "fixed_amount",
        "discountValue": 20,
        "startAt": "2025-11-01T00:00:00Z",
        "endAt": "2025-11-11T23:59:59Z",
        "status": "active",
        "totalQuota": 1000,
        "claimedCount": 856,
        "usedCount": 523,
        "usageRate": "61.1%",
        "gmv": 41337,
        "createdAt": "2025-10-25T10:00:00Z"
      }
    ],
    "total": 10
  }
}
```

#### 接口6：创建活动
```
POST /admin/promotions
```
**请求体**：
```json
{
  "name": "双十一特惠",
  "type": "coupon",
  "discountType": "fixed_amount" | "percentage",
  "discountValue": 20,
  "startAt": "2025-11-01T00:00:00Z",
  "endAt": "2025-11-11T23:59:59Z",
  "releaseRule": "auto_new_user" | "manual_claim",
  "minOrderAmount": 99,
  "totalQuota": 1000,
  "maxPerUser": 1
}
```

**响应结构**：
```json
{
  "success": true,
  "data": {
    "id": "promo_123",
    "message": "活动创建成功"
  }
}
```

#### 接口7：更新活动
```
PUT /admin/promotions/:id
```
**请求体**：同创建接口

**响应结构**：
```json
{
  "success": true,
  "message": "活动更新成功"
}
```

#### 接口8：下线活动
```
PATCH /admin/promotions/:id/offline
```
**请求体**：无

**响应结构**：
```json
{
  "success": true,
  "message": "活动已下线"
}
```

#### 接口9：获取活动详情
```
GET /admin/promotions/:id
```
**响应结构**：
```json
{
  "success": true,
  "data": {
    "promotion": {
      "id": "promo_123",
      "name": "双十一特惠",
      "type": "coupon",
      "discountType": "fixed_amount",
      "discountValue": 20,
      "startAt": "2025-11-01T00:00:00Z",
      "endAt": "2025-11-11T23:59:59Z",
      "releaseRule": "manual_claim",
      "minOrderAmount": 99,
      "totalQuota": 1000,
      "claimedCount": 856,
      "usedCount": 523,
      "usageRate": "61.1%",
      "gmv": 41337,
      "status": "active",
      "createdAt": "2025-10-25T10:00:00Z"
    }
  }
}
```

#### 接口10：获取领券记录
```
GET /admin/promotions/:id/claims
```
**Query参数**：
- `limit` (optional): 每页数量，默认20
- `offset` (optional): 偏移量，默认0

**响应结构**：
```json
{
  "success": true,
  "data": {
    "claims": [
      {
        "userId": "user_123",
        "phone": "138****5678",
        "couponId": "coupon_abc",
        "claimedAt": "2025-11-01T10:00:00Z"
      }
    ],
    "total": 856
  }
}
```

#### 接口11：获取核销记录
```
GET /admin/promotions/:id/usages
```
**Query参数**：
- `limit` (optional): 每页数量，默认20
- `offset` (optional): 偏移量，默认0

**响应结构**：
```json
{
  "success": true,
  "data": {
    "usages": [
      {
        "orderId": "order_xyz",
        "userId": "user_123",
        "phone": "138****5678",
        "couponId": "coupon_abc",
        "discountAmount": 20,
        "usedAt": "2025-11-02T15:30:00Z"
      }
    ],
    "total": 523
  }
}
```

### 4.3 后端禁止事项
- ❌ 不允许跳过优惠券有效性校验
- ❌ 不允许在订单已支付后再校验优惠券（必须在创建订单时校验）
- ❌ 不允许前端传入折后价（必须由后端计算）
- ❌ 不允许将优惠券核心逻辑暴露给前端

---

## 5. 云函数/大文件处理需求（交给 scf_worker_skill）

### 是否需要SCF
**本轮不需要SCF Worker**

### 理由
- 活动营销系统的核心功能都是轻量级操作：
  - 领取优惠券：数据库写入操作，毫秒级
  - 校验优惠券：数据库查询和逻辑判断，毫秒级
  - 创建订单：数据库事务，秒级以内
- 没有重处理任务（如大文件、视频生成、AI推理）
- 所有接口都是同步接口，不需要异步回调

### Future Plan
如果未来需要以下功能，可能需要SCF Worker：
- **批量发券**：给10万用户批量发放优惠券（异步任务）
- **优惠券推荐引擎**：基于用户行为AI推荐最适合的券（需要模型推理）
- **营销数据分析**：生成复杂的营销报表（耗时查询和计算）

---

## 6. 计费与配额策略（交给 billing_guard_skill）

### 6.1 是否真实扣配额
**本轮活动营销系统不直接扣配额**

### 理由
- 活动系统是对**订单金额**的折扣，不是对**配额次数**的影响
- 用户仍然是购买会员后获得100次配额
- 优惠券只影响**购买会员时的支付金额**，不影响**购买后的配额数量**

### 6.2 关键计费逻辑

#### 原有计费流程（不变）
```
用户购买会员(¥99) → 支付成功 → quota_remaining += 100
```

#### 新增优惠券后的计费流程
```
用户购买会员 → 使用优惠券 → 实付金额 = ¥99 - ¥20 = ¥79
→ 支付成功 → quota_remaining += 100（配额数量不变）
```

### 6.3 重要风控点

#### 风控点1：优惠券库存控制
- **问题**：多用户并发领取同一张券，可能超发
- **方案**：
  - 后端使用**行锁**控制库存：
    ```sql
    UPDATE promotions
    SET claimed_count = claimed_count + 1
    WHERE id = ? AND claimed_count < total_quota
    ```
  - 如果更新影响行数为0，说明已抢光，返回错误

#### 风控点2：防止重复核销
- **问题**：同一张券被多次使用
- **方案**：
  - 创建订单时，使用**数据库事务**：
    ```javascript
    await transaction(async (trx) => {
      // 1. 校验券状态
      const coupon = await trx('user_coupons')
        .where({ id: couponId, status: 'unused' })
        .forUpdate()  // 行锁
        .first();

      if (!coupon) throw new Error('优惠券不可用');

      // 2. 创建订单
      await trx('orders').insert({...});

      // 3. 锁定券状态（支付成功后再变为used）
      await trx('user_coupons')
        .where({ id: couponId })
        .update({ status: 'locked', orderId });
    });
    ```
  - 支付回调成功后，更新券状态为 `used`
  - 支付失败或超时，释放券状态回 `unused`

#### 风控点3：防止折扣金额伪造
- **问题**：前端伪造折后价或折扣金额
- **方案**：
  - 前端**只传** `couponId`，不传折扣金额
  - 后端根据优惠券配置**重新计算**折后价
  - 生成微信支付订单时使用后端计算的金额
  - 绝不信任前端传来的金额

#### 风控点4：优惠券叠加限制
- **问题**：用户尝试同时使用多张券
- **方案**：
  - 当前版本**只允许单张券单次使用**
  - 前端UI设计为单选
  - 后端校验 `couponId` 为单个值（非数组）

### 6.4 财务安全检查点

**Billing Guard Skill 必须审查：**
- ✅ 所有优惠券金额计算是否在后端进行
- ✅ 是否有行锁防止并发超发
- ✅ 是否有事务保证优惠券和订单的原子性
- ✅ 支付失败时是否正确释放优惠券
- ✅ 优惠券状态流转是否完整（unused → locked → used/unused）
- ✅ 是否禁止前端传入折扣金额

### 6.5 不允许的操作
- ❌ 不允许优惠券直接修改用户的 `quota_remaining`
- ❌ 不允许"无限券"（必须有总数量限制）
- ❌ 不允许"永久券"（必须有有效期）
- ❌ 不允许前端计算折后价
- ❌ 不允许跳过优惠券校验直接创建低价订单

---

## 7. 验收标准（交给 qa_acceptance_skill）

### 7.1 功能完成标准

上线后判断功能"算完成"的标准：

#### 标准1：用户可以看到和领取活动
- [ ] 登录后在工作台看到"优惠活动"入口卡片
- [ ] 点击进入活动列表页 `/promotions`
- [ ] 看到至少1个正在进行的活动
- [ ] 点击"立即领取"按钮，领取成功
- [ ] 页面toast提示"领取成功"
- [ ] 按钮变为"已领取"灰色状态

#### 标准2：用户可以在购买时使用优惠券
- [ ] 进入会员购买页 `/membership/buy`
- [ ] 看到"可用优惠券"区域
- [ ] 选择一张券
- [ ] 实时显示折后价（例如 ¥99 → ¥79）
- [ ] 点击"支付 ¥79"
- [ ] 跳转微信支付，支付金额为 ¥79（非 ¥99）
- [ ] 支付成功后，配额正确增加100次
- [ ] 优惠券状态变为"已使用"

#### 标准3：优惠券有效性校验
- [ ] 尝试使用已过期的券，提示"优惠券已过期"
- [ ] 尝试重复领取同一活动的券，提示"您已领取过该券"
- [ ] 活动券被领光后，按钮显示"已抢光"
- [ ] 订单金额不满足使用条件的券，不可选择

#### 标准4：管理员可以创建和管理活动
- [ ] 管理员登录后台
- [ ] 进入活动管理页 `/admin/promotions`
- [ ] 点击"创建活动"，填写表单
- [ ] 提交后，活动出现在列表中
- [ ] 状态显示为"进行中"
- [ ] 可以查看活动详情（已领取数、核销率、GMV）
- [ ] 可以下线活动

#### 标准5：财务数据准确
- [ ] 用户使用¥20优惠券购买会员，微信支付订单金额为¥79
- [ ] 后台订单记录：原价¥99、优惠¥20、实付¥79
- [ ] 活动数据统计：GMV = 所有使用该券的订单实付金额之和
- [ ] 优惠券核销率计算正确：已使用数 / 已领取数

### 7.2 测试场景

#### 场景1：新人注册自动发券
**前置条件**：存在一个"新人券"活动，发放规则为"新人自动发放"
**步骤**：
1. 使用未注册过的手机号注册登录
2. 观察是否自动收到优惠券
3. 查看"我的优惠券"页面，确认券已到账

**预期结果**：
- 前端弹出提示"新人专属优惠券已到账"
- "我的优惠券"页面有1张未使用的券

#### 场景2：并发领券（压力测试）
**前置条件**：创建一个总数为100张的活动
**步骤**：
1. 使用200个不同用户并发领取
2. 观察是否有超发

**预期结果**：
- 最终发放数量 ≤ 100张
- 超出100的用户收到"已抢光"提示
- 数据库 `claimed_count` 准确

#### 场景3：支付失败后券状态恢复
**步骤**：
1. 用户选择优惠券创建订单
2. 跳转微信支付后，故意关闭支付页面
3. 等待订单超时（15分钟）
4. 查看优惠券状态

**预期结果**：
- 订单状态变为"已取消"
- 优惠券状态从"锁定"恢复为"未使用"
- 用户可以再次使用该券

#### 场景4：折后价计算准确性
**步骤**：
1. 创建一张¥20固定金额券
2. 用户购买¥99套餐时使用
3. 创建一张8折券
4. 用户购买¥99套餐时使用

**预期结果**：
- 固定金额券：¥99 - ¥20 = ¥79
- 8折券：¥99 × 0.8 = ¥79.2（向下取整为¥79）
- 微信支付订单金额与计算结果一致

#### 场景5：优惠券过期自动失效
**步骤**：
1. 创建一个有效期为1天的券
2. 用户领取后不使用
3. 等待1天后查看

**预期结果**：
- "我的优惠券"页面该券显示为"已过期"
- 购买时不可选择该券
- 管理后台该券不计入"已使用"数量

### 7.3 数据验证

#### 验证1：优惠券库存一致性
```sql
-- 活动已领取数 = 用户优惠券表该活动的券数量
SELECT
  p.claimed_count AS promotion_claimed,
  COUNT(uc.id) AS actual_claimed
FROM promotions p
LEFT JOIN user_coupons uc ON p.id = uc.promotion_id
WHERE p.id = 'promo_123'
GROUP BY p.id;

-- 预期：promotion_claimed = actual_claimed
```

#### 验证2：优惠券核销率计算
```sql
-- 核销率 = 已使用数 / 已领取数
SELECT
  COUNT(*) AS total_claimed,
  SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS total_used,
  (SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) AS usage_rate
FROM user_coupons
WHERE promotion_id = 'promo_123';
```

#### 验证3：GMV计算
```sql
-- GMV = 所有使用该券的订单实付金额之和
SELECT SUM(final_amount) AS gmv
FROM orders
WHERE coupon_id IN (
  SELECT id FROM user_coupons WHERE promotion_id = 'promo_123'
) AND status = 'paid';
```

### 7.4 用户体验标准

#### 体验1：响应速度
- 活动列表页加载时间 < 1秒
- 领取优惠券响应时间 < 500ms
- 优惠券选择器实时计算折后价 < 100ms

#### 体验2：视觉一致性
- 活动卡片样式遵循品牌高奢风（深色玻璃+霓虹边）
- 优惠券卡片设计精美，有仿真券质感
- 折扣金额用醒目红色标注，提升转化

#### 体验3：错误提示友好
- 所有错误提示文案清晰易懂
- 不显示技术细节（如"优惠券ID不存在"改为"优惠券不可用"）
- 提供明确的下一步操作指引（如"请选择其他券"）

---

## 8. 任务卡清单

### 任务卡1：数据库迁移 - 活动营销表结构
**负责技能**：backend_dev_skill
**任务名**：创建活动营销系统数据库表

**目录范围**：
- ✅ 可修改：`backend/src/db/migrations/`
- ❌ 禁止修改：现有表结构（users, orders, tasks等）

**产出物**：
1. `20251029100001_create_promotions_table.js` - 活动表
2. `20251029100002_create_user_coupons_table.js` - 用户优惠券表
3. `20251029100003_extend_orders_for_coupons.js` - 订单表新增优惠券字段

**表结构要求**：
```sql
-- promotions 活动表
CREATE TABLE promotions (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'coupon' | 'discount_code'
  discount_type VARCHAR(20) NOT NULL, -- 'fixed_amount' | 'percentage'
  discount_value DECIMAL(10,2) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  release_rule VARCHAR(20) NOT NULL, -- 'auto_new_user' | 'manual_claim'
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  total_quota INT NOT NULL,
  claimed_count INT DEFAULT 0,
  max_per_user INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'ended' | 'offline'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_dates (start_at, end_at)
);

-- user_coupons 用户优惠券表
CREATE TABLE user_coupons (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  promotion_id VARCHAR(32) NOT NULL,
  status VARCHAR(20) DEFAULT 'unused', -- 'unused' | 'locked' | 'used' | 'expired'
  order_id VARCHAR(32),
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME,
  expire_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_promotion (promotion_id)
);

-- 扩展 orders 表
ALTER TABLE orders ADD COLUMN coupon_id VARCHAR(32);
ALTER TABLE orders ADD COLUMN original_amount DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN final_amount DECIMAL(10,2);
ALTER TABLE orders ADD INDEX idx_coupon (coupon_id);
```

**禁止事项**：
- 不修改现有表的主键或外键
- 不删除现有字段

**交付方式**：
- Push到 `develop` 分支
- 提供迁移脚本的回滚方法（down函数）

---

### 任务卡2：后端 - 用户端优惠券接口
**负责技能**：backend_dev_skill
**任务名**：实现用户端优惠券相关接口

**目录范围**：
- ✅ 可修改：
  - `backend/src/controllers/promotion.controller.js`（新建）
  - `backend/src/services/promotion.service.js`（新建）
  - `backend/src/routes/promotion.routes.js`（新建）
  - `backend/src/controllers/membership.controller.js`（改造订单创建逻辑）
  - `backend/src/services/payment.service.js`（改造支付回调逻辑）
- ❌ 禁止修改：
  - 配额相关逻辑（quota.service.js）
  - 认证中间件（auth.middleware.js）

**产出物**：
1. 新建 Controller, Service, Routes 文件
2. 实现接口：
   - `GET /promotions/list` - 获取活动列表
   - `POST /promotions/:id/claim` - 领取优惠券
   - `GET /coupons/my` - 获取用户优惠券列表
3. 改造接口：
   - `POST /orders/create` - 支持优惠券参数
   - 支付回调逻辑 - 更新优惠券状态

**技术要求**：
- 领取优惠券时使用**行锁**防止超发：
  ```javascript
  const promotion = await trx('promotions')
    .where({ id: promotionId })
    .forUpdate()
    .first();

  if (promotion.claimed_count >= promotion.total_quota) {
    throw new Error('优惠券已抢光');
  }
  ```
- 创建订单时使用**事务**保证原子性
- 支付回调时更新优惠券状态 `locked → used`
- 支付失败或超时时恢复券状态 `locked → unused`

**禁止事项**：
- 不允许前端传入折扣金额（必须后端计算）
- 不允许跳过优惠券有效性校验
- 不允许在支付前修改券状态为"已使用"

**交付方式**：
- Push到 `develop` 分支
- 提供 API 文档和 Postman Collection

---

### 任务卡3：后端 - 管理员活动管理接口
**负责技能**：backend_dev_skill
**任务名**：实现管理员端活动管理接口

**目录范围**：
- ✅ 可修改：
  - `backend/src/controllers/admin.controller.js`（新增方法）
  - `backend/src/services/promotion.service.js`（新增管理员方法）
  - `backend/src/routes/admin.routes.js`（新增路由）
- ❌ 禁止修改：现有管理员权限校验中间件

**产出物**：
1. 实现接口：
   - `GET /admin/promotions` - 获取活动列表
   - `POST /admin/promotions` - 创建活动
   - `PUT /admin/promotions/:id` - 更新活动
   - `PATCH /admin/promotions/:id/offline` - 下线活动
   - `GET /admin/promotions/:id` - 获取活动详情
   - `GET /admin/promotions/:id/claims` - 获取领券记录
   - `GET /admin/promotions/:id/usages` - 获取核销记录

**技术要求**：
- 创建活动时生成唯一ID（使用 `shortid` 或 `uuid`）
- 计算GMV时汇总所有使用该券的订单实付金额
- 计算核销率：已使用数 / 已领取数
- 支持按活动名称、状态筛选
- 支持分页查询

**禁止事项**：
- 不允许非admin角色调用这些接口
- 不允许下线活动时删除已领取的券

**交付方式**：
- Push到 `develop` 分支
- 提供 API 文档和管理后台接口测试记录

---

### 任务卡4：前端 - 用户端优惠券功能
**负责技能**：frontend_dev_skill
**任务名**：实现用户端优惠券相关页面和组件

**目录范围**：
- ✅ 可修改：
  - `frontend/src/app/promotions/page.tsx`（新建 - 活动列表页）
  - `frontend/src/app/coupons/my/page.tsx`（新建 - 我的优惠券页）
  - `frontend/src/app/membership/buy/page.tsx`（改造 - 新增优惠券选择器）
  - `frontend/src/components/CouponCard.tsx`（新建）
  - `frontend/src/components/CouponSelector.tsx`（新建）
  - `frontend/src/app/workspace/page.tsx`（改造 - 新增活动入口卡片）
- ❌ 禁止修改：
  - 认证相关逻辑
  - 支付流程核心逻辑

**产出物**：
1. 新建页面：
   - `/promotions` - 活动列表页
   - `/coupons/my` - 我的优惠券页
2. 改造页面：
   - `/workspace` - 工作台新增"优惠活动"入口卡片
   - `/membership/buy` - 新增优惠券选择器
3. 新建组件：
   - `CouponCard` - 优惠券卡片
   - `CouponSelector` - 优惠券选择器
   - `PromotionCard` - 活动卡片

**UI设计要求**：
- 严格遵循品牌高奢风：深色渐变背景 + 半透明玻璃卡片 + 霓虹青边按钮
- 优惠券卡片设计为仿真券样式（齿轮边、左侧主色调、右侧金额大字）
- 折扣金额用醒目红色标注（例如 "-¥20"）
- 动画效果：领券成功后卡片闪烁、按钮状态平滑过渡

**交互逻辑**：
- 领券时Loading状态显示
- 领券成功后toast提示 + 按钮变灰"已领取"
- 购买时选择券后实时计算折后价
- 所有错误提示使用友好文案

**禁止事项**：
- 不允许前端本地计算折后价（必须调用后端接口获取）
- 不允许修改优惠券状态（必须通过后端接口）
- 不允许显示内部ID或敏感信息

**交付方式**：
- Push到 `develop` 分支
- 提供页面截图和用户操作录屏

---

### 任务卡5：前端 - 管理员活动管理页面
**负责技能**：frontend_dev_skill
**任务名**：实现管理员端活动管理页面

**目录范围**：
- ✅ 可修改：
  - `frontend/src/app/admin/promotions/page.tsx`（新建 - 活动列表）
  - `frontend/src/app/admin/promotions/new/page.tsx`（新建 - 创建活动）
  - `frontend/src/app/admin/promotions/[id]/page.tsx`（新建 - 活动详情）
  - `frontend/src/app/admin/promotions/[id]/edit/page.tsx`（新建 - 编辑活动）
  - `frontend/src/components/admin/PromotionForm.tsx`（新建 - 活动表单）
- ❌ 禁止修改：
  - 管理员权限校验逻辑
  - 其他管理页面

**产出物**：
1. 新建页面：
   - `/admin/promotions` - 活动列表
   - `/admin/promotions/new` - 创建活动
   - `/admin/promotions/:id` - 活动详情
   - `/admin/promotions/:id/edit` - 编辑活动
2. 新建组件：
   - `PromotionForm` - 活动表单
   - `PromotionStats` - 活动数据统计卡片
   - `ClaimRecordTable` - 领券记录表格
   - `UsageRecordTable` - 核销记录表格

**UI设计要求**：
- 遵循管理后台一致风格
- 表单校验清晰（必填项标红、错误提示明显）
- 数据展示直观（使用图表展示领券趋势、核销趋势）

**功能要求**：
- 活动列表支持搜索、筛选、分页
- 创建活动表单支持所有字段的校验
- 活动详情页展示完整数据和图表
- 下线活动时二次确认

**禁止事项**：
- 不允许非admin角色访问这些页面
- 不允许前端伪造活动数据

**交付方式**：
- Push到 `develop` 分支
- 提供管理后台页面截图

---

### 任务卡6：Billing Guard - 财务安全审查
**负责技能**：billing_guard_skill
**任务名**：审查活动营销系统的计费和财务安全

**审查范围**：
- ✅ 必须审查：
  - 优惠券金额计算逻辑
  - 订单创建时的折扣处理
  - 支付金额准确性
  - 优惠券状态流转
  - 并发控制机制
- ❌ 无需审查：配额扣减逻辑（本功能不涉及）

**审查清单**：
1. **金额计算**：
   - [ ] 所有折扣金额计算是否在后端进行
   - [ ] 是否禁止前端传入折扣金额
   - [ ] 百分比折扣计算是否正确（向下取整）
   - [ ] 固定金额折扣是否有上限保护（不能折扣后为负数）

2. **并发控制**：
   - [ ] 领券时是否使用行锁防止超发
   - [ ] 创建订单时是否使用事务保证原子性
   - [ ] 是否有防止同一券重复使用的机制

3. **状态流转**：
   - [ ] 优惠券状态流转是否完整（unused → locked → used/unused）
   - [ ] 支付失败时是否正确释放券状态
   - [ ] 券过期时是否自动标记为expired

4. **财务安全**：
   - [ ] 微信支付订单金额是否为后端计算的折后价
   - [ ] 订单记录是否完整（原价、折扣、实付）
   - [ ] 是否有防止金额伪造的机制

5. **商业模式合规**：
   - [ ] 是否允许"无限券"或"永久券"（必须禁止）
   - [ ] 优惠券是否只影响支付金额，不影响配额数量
   - [ ] 是否有每人领取上限和总数量上限

**产出物**：
- 审查报告：`docs/REVIEW-活动营销系统-BillingGuard.md`
- 列出所有风险点和修复建议
- 通过标准：所有审查项全部 ✅

**禁止事项**：
- 不允许通过有明显财务漏洞的实现
- 不允许跳过并发控制审查

**交付方式**：
- 审查报告Push到 `develop` 分支
- 在 PR 中添加审查意见

---

### 任务卡7：QA - 功能验收测试
**负责技能**：qa_acceptance_skill
**任务名**：活动营销系统功能验收测试

**测试范围**：
- ✅ 必须测试：
  - 用户端所有功能流程
  - 管理员端所有功能流程
  - 并发场景压力测试
  - 财务数据准确性验证
- ❌ 无需测试：配额扣减逻辑（不涉及）

**测试场景**：
1. 用户端功能测试（参考第7节验收标准）
2. 管理员端功能测试
3. 并发压力测试（100用户并发领券）
4. 支付流程测试（成功、失败、超时）
5. 数据一致性测试（优惠券库存、GMV计算）

**产出物**：
- 测试报告：`docs/TEST-REPORT-活动营销系统.md`
- 包含：
  - 所有测试场景和结果
  - 发现的Bug列表
  - 性能测试数据
  - 通过/不通过判定

**通过标准**：
- 所有功能测试场景100%通过
- 并发测试无超发现象
- 财务数据100%准确

**禁止事项**：
- 不允许跳过并发测试
- 不允许跳过财务数据验证

**交付方式**：
- 测试报告Push到 `develop` 分支
- 所有Bug修复后重新测试并更新报告

---

### 任务卡8：Reviewer - 代码审查
**负责技能**：reviewer_skill
**任务名**：活动营销系统代码审查

**审查范围**：
- ✅ 必须审查：
  - 代码质量（可读性、可维护性）
  - 安全性（SQL注入、XSS等）
  - 性能（查询优化、索引使用）
  - 接口合同兼容性
  - 品牌视觉一致性

**审查清单**：
1. **代码质量**：
   - [ ] 是否符合项目编码规范
   - [ ] 是否有足够的注释
   - [ ] 是否有重复代码需要重构
   - [ ] 错误处理是否完善

2. **安全性**：
   - [ ] 是否有SQL注入风险
   - [ ] 用户输入是否做了校验和转义
   - [ ] 是否暴露了敏感信息

3. **性能**：
   - [ ] 数据库查询是否有索引支持
   - [ ] 是否有N+1查询问题
   - [ ] 是否有不必要的多次查询

4. **接口兼容性**：
   - [ ] 是否破坏了现有接口合同
   - [ ] 新增字段是否向后兼容

5. **视觉一致性**：
   - [ ] 前端页面是否符合品牌高奢风
   - [ ] 交互体验是否流畅

**产出物**：
- 审查报告：`docs/REVIEW-活动营销系统-Reviewer.md`
- 包含：
  - 审查意见列表
  - 需要修改的代码位置
  - 通过/不通过判定

**通过标准**：
- 所有审查项全部 ✅
- 无安全风险
- 无性能问题

**禁止事项**：
- 不允许通过有明显安全漏洞的代码
- 不允许通过破坏接口兼容性的代码

**交付方式**：
- 审查报告Push到 `develop` 分支
- 在 PR 中添加审查意见
- 所有问题修复后批准合并

---

## 9. 总结给老板

### 一句话总结
**构建完整的活动营销系统，支持优惠券创建、发放、领取、使用全流程，增强用户转化和复购能力。**

### 执行顺序

**阶段1：数据库和后端基础（预计3-4天）**
1. 任务卡1：数据库迁移 - 创建活动营销表结构
2. 任务卡2：后端 - 用户端优惠券接口
3. 任务卡3：后端 - 管理员活动管理接口

**阶段2：前端页面开发（预计3-4天）**
4. 任务卡4：前端 - 用户端优惠券功能
5. 任务卡5：前端 - 管理员活动管理页面

**阶段3：审查和测试（预计2-3天）**
6. 任务卡6：Billing Guard - 财务安全审查
7. 任务卡7：QA - 功能验收测试
8. 任务卡8：Reviewer - 代码审查

**总预计时间：8-11天**

### 风险提醒

#### 风险1：并发超发问题（高风险）
- **风险描述**：多用户并发领取同一活动券，可能导致超发
- **应对方案**：
  - 必须使用数据库行锁 `forUpdate()`
  - 必须在事务中更新库存
  - 必须编写并发测试验证

#### 风险2：支付金额伪造（高风险）
- **风险描述**：前端可能伪造折后价，导致财务损失
- **应对方案**：
  - 后端重新计算所有折扣金额
  - 绝不信任前端传来的金额
  - 微信支付订单金额使用后端计算结果
  - Billing Guard必须严格审查

#### 风险3：优惠券重复使用（高风险）
- **风险描述**：同一张券被多次使用
- **应对方案**：
  - 创建订单时使用事务 + 行锁
  - 优惠券状态流转完整（unused → locked → used）
  - 支付失败时正确恢复状态

#### 风险4：开发周期可能延长（中风险）
- **风险描述**：涉及前后端多个模块，可能遇到集成问题
- **应对方案**：
  - 严格按阶段执行
  - 后端先完成并提供Mock数据
  - 前后端并行开发
  - 预留Buffer时间

#### 风险5：用户体验不达标（中风险）
- **风险描述**：优惠券功能可能影响购买流程体验
- **应对方案**：
  - 设计阶段充分考虑用户路径
  - 优惠券选择器设计简洁直观
  - 折后价实时计算和显示
  - QA阶段重点测试用户体验

### 关键成功因素

1. **财务安全第一**：Billing Guard审查必须严格，绝不允许有财务漏洞
2. **并发控制准确**：行锁和事务机制必须正确实现
3. **用户体验流畅**：优惠券功能不应增加购买流程的复杂度
4. **数据统计准确**：GMV、核销率等数据必须准确可靠
5. **代码质量高**：为后续扩展（如折扣码、分销佣金）打好基础

---

**🎉 活动营销系统PRD完成！**
