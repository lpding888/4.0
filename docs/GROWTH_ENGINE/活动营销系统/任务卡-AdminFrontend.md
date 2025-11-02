# 任务卡：前端开发 - 活动营销系统（管理端）

> **负责技能**：frontend_dev_skill
> **优先级**：P0
> **预计工期**：2天

---

## 任务目标

实现管理员端活动营销管理页面，包括活动列表、创建/编辑活动、活动详情和数据统计。

---

## 产出物清单

### 新建页面
1. `/admin/promotions` - 活动管理列表
2. `/admin/promotions/new` - 创建活动
3. `/admin/promotions/[id]` - 活动详情
4. `/admin/promotions/[id]/edit` - 编辑活动

### 新建组件
1. `PromotionForm.tsx` - 活动表单组件
2. `PromotionStats.tsx` - 活动数据统计卡片
3. `ClaimRecordTable.tsx` - 领券记录表格
4. `UsageRecordTable.tsx` - 核销记录表格

---

## 详细设计

### 1. 活动管理列表 `/admin/promotions`

**页面结构**：
```tsx
export default function AdminPromotionsPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">活动管理</h1>
          <Link href="/admin/promotions/new">
            <Button>创建活动</Button>
          </Link>
        </div>

        {/* 搜索栏 */}
        <SearchBar
          placeholder="搜索活动名称"
          onSearch={handleSearch}
        />

        {/* 活动表格 */}
        <Table>
          <thead>
            <tr>
              <th>活动名称</th>
              <th>类型</th>
              <th>优惠金额</th>
              <th>有效期</th>
              <th>状态</th>
              <th>已领取/总数</th>
              <th>核销率</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.discountType === 'fixed_amount' ? '固定金额' : '百分比'}</td>
                <td>¥{p.discountValue}</td>
                <td>{formatDateRange(p.startAt, p.endAt)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{p.claimedCount} / {p.totalQuota}</td>
                <td>{p.usageRate}</td>
                <td>
                  <Link href={`/admin/promotions/${p.id}`}>详情</Link>
                  <Link href={`/admin/promotions/${p.id}/edit`}>编辑</Link>
                  <Button onClick={() => handleOffline(p.id)}>下线</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* 分页 */}
        <Pagination total={total} current={page} onChange={setPage} />
      </div>
    </AdminLayout>
  );
}
```

**接口调用**：
```typescript
const { data } = await api.get('/admin/promotions', {
  params: { limit, offset, keyword, status }
});
```

---

### 2. 创建活动 `/admin/promotions/new`

**PromotionForm组件**：
```tsx
interface PromotionFormData {
  name: string;
  type: 'coupon' | 'discount_code';
  discountType: 'fixed_amount' | 'percentage';
  discountValue: number;
  startAt: Date;
  endAt: Date;
  releaseRule: 'auto_new_user' | 'manual_claim';
  minOrderAmount: number;
  totalQuota: number;
  maxPerUser: number;
}

export function PromotionForm({ onSubmit, initialData }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<PromotionFormData>({
    defaultValues: initialData
  });

  const discountType = watch('discountType');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 活动名称 */}
      <FormField
        label="活动名称"
        required
        error={errors.name?.message}
      >
        <Input
          {...register('name', { required: '请输入活动名称' })}
          placeholder="例如：双十一特惠"
        />
      </FormField>

      {/* 活动类型 */}
      <FormField label="活动类型" required>
        <Select {...register('type')}>
          <option value="coupon">优惠券</option>
          <option value="discount_code">折扣码</option>
        </Select>
      </FormField>

      {/* 折扣类型 */}
      <FormField label="折扣类型" required>
        <RadioGroup {...register('discountType')}>
          <Radio value="fixed_amount">固定金额</Radio>
          <Radio value="percentage">百分比折扣</Radio>
        </RadioGroup>
      </FormField>

      {/* 折扣值 */}
      <FormField
        label={discountType === 'fixed_amount' ? '优惠金额（元）' : '折扣百分比'}
        required
      >
        <Input
          type="number"
          {...register('discountValue', {
            required: '请输入折扣值',
            min: { value: 1, message: '折扣值必须大于0' }
          })}
          placeholder={discountType === 'fixed_amount' ? '例如：20' : '例如：80（表示8折）'}
        />
      </FormField>

      {/* 有效期 */}
      <FormField label="有效期" required>
        <DateRangePicker
          startDate={watch('startAt')}
          endDate={watch('endAt')}
          onChange={({ startDate, endDate }) => {
            setValue('startAt', startDate);
            setValue('endAt', endDate);
          }}
        />
      </FormField>

      {/* 发放规则 */}
      <FormField label="发放规则" required>
        <RadioGroup {...register('releaseRule')}>
          <Radio value="auto_new_user">新人自动发放</Radio>
          <Radio value="manual_claim">用户手动领取</Radio>
        </RadioGroup>
      </FormField>

      {/* 使用条件 */}
      <FormField label="使用条件">
        <Input
          type="number"
          {...register('minOrderAmount')}
          placeholder="订单满多少元可用，0表示无门槛"
        />
      </FormField>

      {/* 发放数量 */}
      <FormField label="总发放数量" required>
        <Input
          type="number"
          {...register('totalQuota', {
            required: '请输入总数量',
            min: { value: 1, message: '至少发放1张' }
          })}
          placeholder="例如：1000"
        />
      </FormField>

      {/* 每人限领 */}
      <FormField label="每人限领数量" required>
        <Input
          type="number"
          {...register('maxPerUser', {
            required: '请输入限领数量',
            min: { value: 1, message: '至少1张' }
          })}
          placeholder="例如：1"
        />
      </FormField>

      <div className="flex gap-4">
        <Button type="submit">保存</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
```

**创建逻辑**：
```typescript
const handleCreate = async (data: PromotionFormData) => {
  try {
    await api.post('/admin/promotions', data);
    toast.success('活动创建成功');
    router.push('/admin/promotions');
  } catch (error) {
    toast.error(error.message);
  }
};
```

---

### 3. 活动详情 `/admin/promotions/[id]`

**页面结构**：
```tsx
export default function PromotionDetailPage({ params }: { params: { id: string } }) {
  const { data: promotion } = useSWR(`/admin/promotions/${params.id}`, fetcher);
  const [activeTab, setActiveTab] = useState<'claims' | 'usages'>('claims');

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 基本信息卡片 */}
        <Card>
          <CardHeader>
            <h2>{promotion.name}</h2>
            <StatusBadge status={promotion.status} />
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt>活动类型</dt>
                <dd>{promotion.type === 'coupon' ? '优惠券' : '折扣码'}</dd>
              </div>
              <div>
                <dt>折扣金额</dt>
                <dd>¥{promotion.discountValue}</dd>
              </div>
              <div>
                <dt>有效期</dt>
                <dd>{formatDateRange(promotion.startAt, promotion.endAt)}</dd>
              </div>
              <div>
                <dt>发放规则</dt>
                <dd>{promotion.releaseRule === 'auto_new_user' ? '新人自动发放' : '用户手动领取'}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* 数据统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="已领取"
            value={promotion.claimedCount}
            total={promotion.totalQuota}
            color="blue"
          />
          <StatCard
            label="已使用"
            value={promotion.usedCount}
            color="green"
          />
          <StatCard
            label="核销率"
            value={`${promotion.usageRate}%`}
            color="purple"
          />
          <StatCard
            label="带来GMV"
            value={`¥${promotion.gmv}`}
            color="orange"
          />
        </div>

        {/* Tab切换 */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tab value="claims">领券记录</Tab>
          <Tab value="usages">核销记录</Tab>
        </Tabs>

        {/* 记录表格 */}
        {activeTab === 'claims' ? (
          <ClaimRecordTable promotionId={params.id} />
        ) : (
          <UsageRecordTable promotionId={params.id} />
        )}
      </div>
    </AdminLayout>
  );
}
```

**ClaimRecordTable组件**：
```tsx
export function ClaimRecordTable({ promotionId }: { promotionId: string }) {
  const { data, error } = useSWR(`/admin/promotions/${promotionId}/claims`, fetcher);

  return (
    <Table>
      <thead>
        <tr>
          <th>用户ID</th>
          <th>手机号</th>
          <th>领取时间</th>
        </tr>
      </thead>
      <tbody>
        {data?.claims.map(claim => (
          <tr key={claim.couponId}>
            <td>{claim.userId}</td>
            <td>{claim.phone}</td>
            <td>{formatDateTime(claim.claimedAt)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
```

**UsageRecordTable组件**：
```tsx
export function UsageRecordTable({ promotionId }: { promotionId: string }) {
  const { data } = useSWR(`/admin/promotions/${promotionId}/usages`, fetcher);

  return (
    <Table>
      <thead>
        <tr>
          <th>订单号</th>
          <th>用户</th>
          <th>抵扣金额</th>
          <th>使用时间</th>
        </tr>
      </thead>
      <tbody>
        {data?.usages.map(usage => (
          <tr key={usage.orderId}>
            <td>{usage.orderId}</td>
            <td>{usage.phone}</td>
            <td>¥{usage.discountAmount}</td>
            <td>{formatDateTime(usage.usedAt)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
```

---

## UI设计要求

### 管理后台风格
- 简洁专业，重数据展示
- 表格清晰易读
- 表单字段对齐整齐
- 状态标签颜色明确
  - 进行中：绿色
  - 已结束：灰色
  - 已下线：红色

### 数据统计卡片
```tsx
function StatCard({ label, value, total, color }: StatCardProps) {
  return (
    <div className={`stat-card bg-${color}-50 border-${color}-200`}>
      <div className="stat-label text-gray-600">{label}</div>
      <div className={`stat-value text-${color}-600 text-3xl font-bold`}>
        {value}
        {total && <span className="text-lg text-gray-400"> / {total}</span>}
      </div>
    </div>
  );
}
```

---

## 验证清单

- [ ] 活动列表正确显示
- [ ] 创建活动表单校验正确
- [ ] 编辑活动可保存修改
- [ ] 活动详情数据完整
- [ ] 领券记录和核销记录正确显示
- [ ] 下线活动功能正常
- [ ] 搜索和筛选功能正常
- [ ] 分页功能正常

---

**预计工作量**：2天
