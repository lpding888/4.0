# 任务卡：前端开发 - 活动营销系统（用户端）

> **负责技能**：frontend_dev_skill
> **优先级**：P0
> **预计工期**：2.5天

---

## 任务目标

实现用户端活动营销相关页面，包括活动列表、我的优惠券、优惠券选择器，以及改造会员购买页面支持优惠券使用。

---

## 产出物清单

### 新建页面
1. `/promotions` - 活动列表页
2. `/coupons/my` - 我的优惠券页
3. `/workspace`（改造）- 工作台新增活动入口卡片
4. `/membership/buy`（改造）- 会员购买页新增优惠券选择器

### 新建组件
1. `CouponCard.tsx` - 优惠券卡片组件
2. `CouponSelector.tsx` - 优惠券选择器组件
3. `PromotionCard.tsx` - 活动卡片组件

---

## 详细设计

### 1. 活动列表页 `/promotions`

**入口**：工作台"优惠活动"功能卡片

**页面结构**：
```tsx
// src/app/promotions/page.tsx
export default function PromotionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-white mb-8">限时优惠活动</h1>
        <div className="grid gap-4">
          {promotions.map(p => <PromotionCard key={p.id} promotion={p} />)}
        </div>
      </div>
    </div>
  );
}
```

**PromotionCard组件设计**：
- 半透明玻璃卡片效果（backdrop-blur-md）
- 左侧：活动图标+HOT/NEW标签
- 中间：活动名称、优惠金额、有效期、使用条件
- 右侧：CTA按钮
  - 未领取："立即领取"（霓虹青边按钮）
  - 已领取："已领取"（灰色禁用）
  - 已抢光："已抢光"（灰色禁用）

**接口调用**：
```typescript
// 获取活动列表
const { data } = await api.get('/promotions/list');

// 领取优惠券
const handleClaim = async (promotionId: string) => {
  try {
    await api.post(`/promotions/${promotionId}/claim`);
    toast.success('领取成功！');
    refreshList();
  } catch (error) {
    toast.error(error.message);
  }
};
```

---

### 2. 我的优惠券页 `/coupons/my`

**入口**：个人中心"我的优惠券"菜单项

**页面结构**：
```tsx
export default function MyCouponsPage() {
  const [activeTab, setActiveTab] = useState<'unused' | 'used' | 'expired'>('unused');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Tab切换 */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="unused">未使用</Tab>
        <Tab value="used">已使用</Tab>
        <Tab value="expired">已过期</Tab>
      </Tabs>

      {/* 优惠券列表 */}
      <div className="grid gap-4 mt-6">
        {coupons.map(c => <CouponCard key={c.id} coupon={c} />)}
      </div>
    </div>
  );
}
```

**CouponCard组件设计**：
- 仿真券样式（左侧齿轮边、右侧金额大字）
- 显示内容：
  - 活动名称
  - 优惠金额（大字醒目）
  - 有效期
  - 使用条件
  - 状态标签
- 未使用的券：显示"去使用"按钮
- 已使用/已过期：整张卡片灰化

---

### 3. 会员购买页改造 `/membership/buy`

**新增区域**："可用优惠券"选择器

**改造要点**：
```tsx
export default function MembershipBuyPage() {
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [originalAmount] = useState(99);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(99);

  // 选择优惠券时实时计算折后价
  const handleSelectCoupon = (coupon: Coupon) => {
    setSelectedCoupon(coupon.id);
    const discount = calculateDiscount(coupon, originalAmount);
    setDiscountAmount(discount);
    setFinalAmount(originalAmount - discount);
  };

  // 创建订单
  const handlePay = async () => {
    const { data } = await api.post('/orders/create', {
      planType: 'monthly',
      couponId: selectedCoupon  // 传入优惠券ID
    });
    // 跳转支付
    window.location.href = data.paymentUrl;
  };

  return (
    <div className="payment-page">
      {/* 原有内容 */}
      <div className="price-display">
        {discountAmount > 0 && (
          <div className="original-price text-gray-400 line-through">
            ¥{originalAmount}
          </div>
        )}
        <div className="final-price text-4xl text-cyan-400">
          ¥{finalAmount}
        </div>
        {discountAmount > 0 && (
          <div className="discount-badge text-red-400">
            已优惠 ¥{discountAmount}
          </div>
        )}
      </div>

      {/* 新增：优惠券选择器 */}
      <CouponSelector
        selectedCouponId={selectedCoupon}
        onSelect={handleSelectCoupon}
        minOrderAmount={originalAmount}
      />

      <button onClick={handlePay} className="pay-button">
        支付 ¥{finalAmount}
        {discountAmount > 0 && `（已优惠¥${discountAmount}）`}
      </button>
    </div>
  );
}
```

**CouponSelector组件**：
```tsx
interface CouponSelectorProps {
  selectedCouponId: string | null;
  onSelect: (coupon: Coupon) => void;
  minOrderAmount: number;
}

export function CouponSelector({ selectedCouponId, onSelect, minOrderAmount }: CouponSelectorProps) {
  const { data: coupons } = useSWR('/coupons/my?status=unused', fetcher);

  return (
    <div className="coupon-selector">
      <h3>可用优惠券</h3>
      <div className="coupon-list">
        {coupons?.map(coupon => (
          <div
            key={coupon.id}
            className={cn(
              'coupon-item',
              selectedCouponId === coupon.id && 'selected',
              !canUseCoupon(coupon, minOrderAmount) && 'disabled'
            )}
            onClick={() => canUseCoupon(coupon, minOrderAmount) && onSelect(coupon)}
          >
            <div className="coupon-amount">¥{coupon.discountValue}</div>
            <div className="coupon-info">
              <div>{coupon.promotionName}</div>
              <div className="text-sm text-gray-400">
                满¥{coupon.minOrderAmount}可用
              </div>
            </div>
            {selectedCouponId === coupon.id && <CheckIcon />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. 工作台改造 `/workspace`

**新增功能卡片**："优惠活动"

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* 现有功能卡片 */}
  <FeatureCard title="基础修图" ... />
  <FeatureCard title="AI模特" ... />

  {/* 新增：优惠活动卡片 */}
  <FeatureCard
    title="优惠活动"
    description="限时优惠券，立即领取"
    icon={<GiftIcon />}
    onClick={() => router.push('/promotions')}
    className="bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-400/30"
  />
</div>
```

---

## UI设计要求

### 品牌高奢风格（严格遵循）
- 深色渐变背景：`bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900`
- 半透明玻璃卡片：`backdrop-blur-md bg-white/5 border border-white/10`
- 霓虹青边按钮：`border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400/10`
- 大而轻的标题：`text-4xl font-light text-white`
- 半透明说明文：`text-sm text-gray-400`

### 优惠券卡片设计
```css
.coupon-card {
  position: relative;
  background: linear-gradient(135deg, rgba(251, 113, 133, 0.1), rgba(236, 72, 153, 0.1));
  border: 1px solid rgba(251, 113, 133, 0.3);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.coupon-card::before {
  /* 左侧齿轮边效果 */
  content: '';
  position: absolute;
  left: -1px;
  top: 50%;
  width: 20px;
  height: 20px;
  background: radial-gradient(circle, transparent 50%, rgba(251, 113, 133, 0.3) 50%);
}

.coupon-amount {
  font-size: 48px;
  font-weight: 700;
  color: #f87171;
  text-shadow: 0 0 20px rgba(248, 113, 113, 0.5);
}
```

### 动画效果
- 领券成功：卡片闪烁动画
- 按钮状态：平滑过渡（transition-all duration-300）
- 优惠券选择：选中时边框高亮

---

## 技术要求

### 状态管理
```typescript
// src/store/promotionStore.ts
import { create } from 'zustand';

interface PromotionStore {
  selectedCoupon: string | null;
  setSelectedCoupon: (id: string | null) => void;
}

export const usePromotionStore = create<PromotionStore>((set) => ({
  selectedCoupon: null,
  setSelectedCoupon: (id) => set({ selectedCoupon: id }),
}));
```

### 数据获取（SWR）
```typescript
import useSWR from 'swr';

const { data, error, mutate } = useSWR('/promotions/list', fetcher);
```

### 错误处理
```typescript
try {
  await api.post(`/promotions/${id}/claim`);
  toast.success('领取成功！', {
    icon: '🎉',
    style: {
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgb(34, 197, 94)',
      color: '#fff',
    },
  });
} catch (error) {
  toast.error(error.response?.data?.message || '领取失败', {
    style: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgb(239, 68, 68)',
      color: '#fff',
    },
  });
}
```

---

## 禁止事项

❌ **严格禁止**：
1. 不允许前端本地计算折后价（必须调用后端API）
2. 不允许修改优惠券状态（必须通过后端接口）
3. 不允许显示内部优惠券ID或敏感信息
4. 不允许跳过优惠券有效性检查
5. 不允许使用与品牌风格不符的UI设计

---

## 验证清单

### 功能测试
- [ ] 活动列表页正确显示所有活动
- [ ] 领取优惠券成功，按钮变为"已领取"
- [ ] 我的优惠券页正确显示已领取的券
- [ ] Tab切换正常（未使用/已使用/已过期）
- [ ] 会员购买页正确显示可用优惠券
- [ ] 选择优惠券后实时显示折后价
- [ ] 支付金额正确（使用折后价）
- [ ] 工作台新增活动入口卡片

### UI验证
- [ ] 所有页面遵循品牌高奢风格
- [ ] 优惠券卡片设计精美有质感
- [ ] 动画效果流畅自然
- [ ] 移动端适配良好

### 用户体验
- [ ] 领券成功有明显反馈
- [ ] 错误提示友好易懂
- [ ] Loading状态清晰
- [ ] 操作流程顺畅无卡顿

---

## 交付方式

```bash
git add frontend/src/app/promotions/
git add frontend/src/app/coupons/
git add frontend/src/components/CouponCard.tsx
git add frontend/src/components/CouponSelector.tsx
git add frontend/src/components/PromotionCard.tsx
git commit -m "feat(frontend): implement promotion and coupon user pages"
git push origin develop
```

---

**预计工作量**：2.5天
