# 任务卡:前端开发 - 分销代理系统(用户端)

> **负责技能**:frontend_dev_skill
> **优先级**:P0
> **预计工期**:2.5天

---

## 任务目标

实现用户端分销代理相关页面,包括分销员申请、分销中心、推广列表、佣金明细、提现管理等功能。

---

## 产出物清单

### 新建页面
1. `/distribution/apply` - 申请成为分销员
2. `/distribution/dashboard` - 分销中心首页
3. `/distribution/referrals` - 我的推广
4. `/distribution/commissions` - 佣金明细
5. `/distribution/withdrawals` - 提现记录
6. `/distribution/withdraw/new` - 申请提现
7. `/workspace`(改造) - 工作台新增"分销中心"入口卡片

### 新建组件
1. `DistributorCard.tsx` - 分销员身份卡片
2. `ReferralCard.tsx` - 推广用户卡片
3. `CommissionCard.tsx` - 佣金记录卡片
4. `WithdrawalCard.tsx` - 提现记录卡片

---

## 详细设计

### 1. 分销员申请页 `/distribution/apply`

**入口**:工作台"分销中心"功能卡片(首次点击进入申请页)

**页面结构**:
```tsx
// src/app/distribution/apply/page.tsx
export default function DistributionApplyPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    try {
      await api.post('/distribution/apply', data);
      toast.success('申请已提交,请等待审核');
      router.push('/workspace');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-light text-white mb-8">申请成为分销员</h1>

        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8">
          {/* 福利说明 */}
          <div className="mb-8 p-4 bg-cyan-500/10 border border-cyan-400/30 rounded-lg">
            <h3 className="text-cyan-400 text-lg font-semibold mb-2">分销员福利</h3>
            <ul className="text-gray-300 space-y-2">
              <li>✅ 每推荐1位新用户购买会员,赚取15%佣金</li>
              <li>✅ 佣金可随时提现,单笔最低¥100</li>
              <li>✅ 无限推广,收益无上限</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField label="真实姓名" required error={errors.realName?.message}>
              <Input
                {...register('realName', { required: '请输入真实姓名' })}
                placeholder="请输入真实姓名"
              />
            </FormField>

            <FormField label="身份证号" required error={errors.idCard?.message}>
              <Input
                {...register('idCard', {
                  required: '请输入身份证号',
                  pattern: {
                    value: /^\d{17}[\dXx]$/,
                    message: '身份证号格式不正确'
                  }
                })}
                placeholder="请输入18位身份证号"
              />
            </FormField>

            <FormField label="联系方式" required error={errors.contact?.message}>
              <Input
                {...register('contact', { required: '请输入联系方式' })}
                placeholder="微信号或手机号"
              />
            </FormField>

            <FormField label="推广渠道说明">
              <Textarea
                {...register('channel')}
                placeholder="请简要说明您的推广渠道(例如:朋友圈、微信群、个人博客等)"
                rows={4}
              />
            </FormField>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold"
            >
              提交申请
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

---

### 2. 分销中心首页 `/distribution/dashboard`

**入口**:工作台"分销中心"功能卡片(审核通过后进入)

**页面结构**:
```tsx
export default function DistributionDashboardPage() {
  const { data: status } = useSWR('/distribution/status', fetcher);
  const { data: dashboard } = useSWR('/distribution/dashboard', fetcher);

  if (status?.status === 'pending') {
    return <PendingApprovalView />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-white mb-8">分销中心</h1>

        {/* 分销员身份卡片 */}
        <DistributorCard
          inviteCode={status?.inviteCode}
          inviteLink={status?.inviteLink}
        />

        {/* 数据概览 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <StatCard
            label="推广人数"
            value={dashboard?.totalReferrals || 0}
            icon={<UsersIcon />}
            color="blue"
          />
          <StatCard
            label="累计佣金"
            value={`¥${dashboard?.totalCommission || 0}`}
            icon={<CoinsIcon />}
            color="green"
          />
          <StatCard
            label="可提现"
            value={`¥${dashboard?.availableCommission || 0}`}
            icon={<WalletIcon />}
            color="cyan"
          />
          <StatCard
            label="已提现"
            value={`¥${dashboard?.withdrawnCommission || 0}`}
            icon={<CheckCircleIcon />}
            color="purple"
          />
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Link href="/distribution/referrals">
            <ActionCard title="我的推广" icon={<UsersIcon />} />
          </Link>
          <Link href="/distribution/commissions">
            <ActionCard title="佣金明细" icon={<ListIcon />} />
          </Link>
          <Link href="/distribution/withdraw/new">
            <ActionCard
              title="申请提现"
              icon={<MoneyIcon />}
              highlight={dashboard?.availableCommission >= 100}
            />
          </Link>
        </div>

        {/* 推广素材 */}
        <div className="mt-8 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl text-white mb-4">推广素材</h3>
          <div className="flex gap-4">
            <Button onClick={() => copyToClipboard(status?.inviteLink)}>
              复制推广链接
            </Button>
            <Button onClick={() => generatePoster(status?.inviteCode)}>
              生成推广海报
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**DistributorCard组件**:
```tsx
export function DistributorCard({ inviteCode, inviteLink }: Props) {
  return (
    <div className="backdrop-blur-md bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">您的专属邀请码</div>
          <div className="text-4xl font-bold text-cyan-400 mt-2 tracking-widest">
            {inviteCode}
          </div>
        </div>
        <QRCode value={inviteLink} size={120} />
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => copyToClipboard(inviteCode)}
          variant="outline"
          className="flex-1"
        >
          复制邀请码
        </Button>
        <Button
          onClick={() => copyToClipboard(inviteLink)}
          className="flex-1 bg-cyan-400 text-slate-900"
        >
          复制推广链接
        </Button>
      </div>
    </div>
  );
}
```

---

### 3. 我的推广 `/distribution/referrals`

**页面结构**:
```tsx
export default function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'unpaid'>('all');
  const { data } = useSWR(`/distribution/referrals?status=${activeTab}`, fetcher);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-white mb-8">我的推广</h1>

        {/* Tab切换 */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tab value="all">全部({data?.total})</Tab>
          <Tab value="paid">已购买</Tab>
          <Tab value="unpaid">未购买</Tab>
        </Tabs>

        {/* 推广用户列表 */}
        <div className="mt-6 space-y-4">
          {data?.referrals.map(referral => (
            <ReferralCard key={referral.userId} referral={referral} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**ReferralCard组件**:
```tsx
export function ReferralCard({ referral }: Props) {
  return (
    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Avatar src={referral.avatar} />
        <div>
          <div className="text-white font-medium">{referral.phone}</div>
          <div className="text-sm text-gray-400">
            注册于 {formatDate(referral.registeredAt)}
          </div>
        </div>
      </div>
      <div className="text-right">
        {referral.hasPaid ? (
          <>
            <div className="text-green-400 font-semibold">
              +¥{referral.commissionAmount}
            </div>
            <div className="text-sm text-gray-400">已购买</div>
          </>
        ) : (
          <div className="text-gray-400">未购买</div>
        )}
      </div>
    </div>
  );
}
```

---

### 4. 佣金明细 `/distribution/commissions`

**页面结构**:
```tsx
export default function CommissionsPage() {
  const [status, setStatus] = useState<'all' | 'frozen' | 'available'>('all');
  const { data } = useSWR(
    `/distribution/commissions${status !== 'all' ? `?status=${status}` : ''}`,
    fetcher
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-white mb-8">佣金明细</h1>

        {/* 状态筛选 */}
        <div className="flex gap-2 mb-6">
          <FilterButton
            active={status === 'all'}
            onClick={() => setStatus('all')}
          >
            全部
          </FilterButton>
          <FilterButton
            active={status === 'frozen'}
            onClick={() => setStatus('frozen')}
          >
            冻结中
          </FilterButton>
          <FilterButton
            active={status === 'available'}
            onClick={() => setStatus('available')}
          >
            已到账
          </FilterButton>
        </div>

        {/* 佣金记录列表 */}
        <div className="space-y-4">
          {data?.commissions.map(commission => (
            <CommissionCard key={commission.id} commission={commission} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**CommissionCard组件**:
```tsx
export function CommissionCard({ commission }: Props) {
  return (
    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-white font-medium">订单 {commission.orderId}</div>
          <div className="text-sm text-gray-400 mt-1">
            用户 {commission.referredUserPhone}
          </div>
          <div className="text-sm text-gray-400">
            订单金额 ¥{commission.orderAmount}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">
            +¥{commission.commissionAmount}
          </div>
          <StatusBadge status={commission.status} />
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {commission.status === 'frozen' ? (
          `冻结至 ${formatDate(commission.freezeUntil)}`
        ) : (
          `到账于 ${formatDate(commission.settledAt)}`
        )}
      </div>
    </div>
  );
}
```

---

### 5. 申请提现 `/distribution/withdraw/new`

**页面结构**:
```tsx
export default function WithdrawPage() {
  const { data: dashboard } = useSWR('/distribution/dashboard', fetcher);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const amount = watch('amount');
  const method = watch('method', 'wechat');

  const onSubmit = async (data) => {
    try {
      if (data.amount < 100) {
        throw new Error('提现金额不能低于¥100');
      }
      if (data.amount > dashboard.availableCommission) {
        throw new Error('提现金额不能超过可提现余额');
      }

      await api.post('/distribution/withdraw', data);
      toast.success('提现申请已提交');
      router.push('/distribution/withdrawals');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-light text-white mb-8">申请提现</h1>

        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8">
          {/* 可提现金额展示 */}
          <div className="mb-8 p-6 bg-green-500/10 border border-green-400/30 rounded-lg text-center">
            <div className="text-sm text-gray-400">可提现金额</div>
            <div className="text-5xl font-bold text-green-400 mt-2">
              ¥{dashboard?.availableCommission || 0}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField label="提现金额" required error={errors.amount?.message}>
              <Input
                type="number"
                step="0.01"
                {...register('amount', {
                  required: '请输入提现金额',
                  min: { value: 100, message: '最低提现¥100' }
                })}
                placeholder="最低¥100"
              />
              <div className="mt-2 text-sm text-gray-400">
                手续费:免费 | 到账金额:¥{amount || 0}
              </div>
            </FormField>

            <FormField label="提现方式" required>
              <RadioGroup {...register('method')}>
                <Radio value="wechat">微信零钱</Radio>
                <Radio value="alipay">支付宝</Radio>
              </RadioGroup>
            </FormField>

            {method === 'wechat' && (
              <FormField label="微信账号" required error={errors.accountInfo?.account?.message}>
                <Input
                  {...register('accountInfo.account', { required: '请输入微信账号' })}
                  placeholder="请输入微信号"
                />
              </FormField>
            )}

            {method === 'alipay' && (
              <FormField label="支付宝账号" required error={errors.accountInfo?.account?.message}>
                <Input
                  {...register('accountInfo.account', { required: '请输入支付宝账号' })}
                  placeholder="请输入支付宝账号"
                />
              </FormField>
            )}

            <FormField label="收款人姓名" required error={errors.accountInfo?.name?.message}>
              <Input
                {...register('accountInfo.name', { required: '请输入真实姓名' })}
                placeholder="请输入与账号匹配的真实姓名"
              />
            </FormField>

            <Button
              type="submit"
              disabled={!amount || amount < 100}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold"
            >
              提交提现申请
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

---

### 6. 提现记录 `/distribution/withdrawals`

**页面结构**:
```tsx
export default function WithdrawalsPage() {
  const { data } = useSWR('/distribution/withdrawals', fetcher);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-light text-white mb-8">提现记录</h1>

        <div className="space-y-4">
          {data?.withdrawals.map(withdrawal => (
            <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**WithdrawalCard组件**:
```tsx
export function WithdrawalCard({ withdrawal }: Props) {
  return (
    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-2xl font-bold text-white">
            ¥{withdrawal.amount}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {withdrawal.method === 'wechat' ? '微信零钱' : '支付宝'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            申请时间:{formatDateTime(withdrawal.createdAt)}
          </div>
        </div>
        <div className="text-right">
          <StatusBadge status={withdrawal.status} />
          {withdrawal.status === 'rejected' && (
            <div className="text-xs text-red-400 mt-1">
              {withdrawal.rejectReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## UI设计要求

### 品牌高奢风格(严格遵循)
- 深色渐变背景:`bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900`
- 半透明玻璃卡片:`backdrop-blur-md bg-white/5 border border-white/10`
- 霓虹青边按钮:`border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400/10`
- 大而轻的标题:`text-4xl font-light text-white`
- 金额数字醒目:大号字体+渐变色+发光效果

### 分销员身份卡片设计
```css
.distributor-card {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2));
  border: 1px solid rgba(6, 182, 212, 0.3);
  backdrop-filter: blur(10px);
}

.invite-code {
  font-size: 2.5rem;
  font-weight: 700;
  color: #06b6d4;
  letter-spacing: 0.5rem;
  text-shadow: 0 0 20px rgba(6, 182, 212, 0.5);
}
```

---

## 技术要求

### 状态管理
```typescript
// src/store/distributionStore.ts
import { create } from 'zustand';

interface DistributionStore {
  distributorStatus: 'none' | 'pending' | 'active' | 'disabled';
  setDistributorStatus: (status: string) => void;
}

export const useDistributionStore = create<DistributionStore>((set) => ({
  distributorStatus: 'none',
  setDistributorStatus: (status) => set({ distributorStatus: status }),
}));
```

### 复制功能
```typescript
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板', { icon: '✓' });
  } catch (error) {
    toast.error('复制失败');
  }
};
```

---

## 禁止事项

❌ **严格禁止**:
1. 不允许前端本地计算佣金金额
2. 不允许修改分销员状态(必须通过后端接口)
3. 不允许显示内部分销员ID或敏感信息
4. 不允许使用与品牌风格不符的UI设计
5. 不允许跳过提现金额校验

---

## 验证清单

### 功能测试
- [ ] 分销员申请提交成功
- [ ] 分销中心数据正确显示
- [ ] 邀请码和推广链接可复制
- [ ] 推广用户列表正确显示
- [ ] 佣金明细状态筛选正常
- [ ] 提现申请表单校验正确
- [ ] 提现记录列表正确显示

### UI验证
- [ ] 所有页面遵循品牌高奢风格
- [ ] 分销员身份卡片设计精美
- [ ] 金额数字醒目突出
- [ ] 移动端适配良好

---

## 交付方式

```bash
git add frontend/src/app/distribution/
git add frontend/src/components/DistributorCard.tsx
git add frontend/src/components/ReferralCard.tsx
git add frontend/src/components/CommissionCard.tsx
git add frontend/src/components/WithdrawalCard.tsx
git commit -m "feat(frontend): implement distribution user pages"
git push origin develop
```

---

**预计工作量**:2.5天
