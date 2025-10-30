# 任务卡:前端开发 - 分销代理系统(管理端)

> **负责技能**:frontend_dev_skill
> **优先级**:P0
> **预计工期**:2天

---

## 任务目标

实现管理员端分销代理管理页面,包括分销员管理、提现审核、数据统计和佣金设置。

---

## 产出物清单

### 新建页面
1. `/admin/distributors` - 分销员管理列表
2. `/admin/distributors/[id]` - 分销员详情
3. `/admin/withdrawals` - 提现审核列表
4. `/admin/distribution/stats` - 分销数据统计
5. `/admin/distribution/settings` - 佣金设置

### 新建组件
1. `DistributorTable.tsx` - 分销员表格
2. `WithdrawalApprovalCard.tsx` - 提现审核卡片
3. `DistributionStatsCard.tsx` - 分销数据统计卡片

---

## 详细设计

### 1. 分销员管理列表 `/admin/distributors`

**页面结构**:
```tsx
export default function AdminDistributorsPage() {
  const [status, setStatus] = useState<'all' | 'pending' | 'active' | 'disabled'>('all');
  const [keyword, setKeyword] = useState('');
  const { data } = useSWR(
    `/admin/distributors?status=${status}&keyword=${keyword}`,
    fetcher
  );

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/admin/distributors/${id}/approve`);
      toast.success('审核通过');
      mutate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDisable = async (id: string) => {
    if (!confirm('确定要禁用该分销员吗?')) return;
    try {
      await api.patch(`/admin/distributors/${id}/disable`);
      toast.success('已禁用');
      mutate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">分销员管理</h1>

        {/* 搜索栏和筛选 */}
        <div className="flex gap-4 mb-6">
          <SearchBar
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索手机号或姓名"
          />
          <Select value={status} onChange={setStatus}>
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="active">已激活</option>
            <option value="disabled">已禁用</option>
          </Select>
        </div>

        {/* 分销员表格 */}
        <Table>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户信息</th>
              <th>真实姓名</th>
              <th>申请时间</th>
              <th>状态</th>
              <th>推广人数</th>
              <th>累计佣金</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data?.distributors.map(d => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>
                  <div>{d.phone}</div>
                  <div className="text-xs text-gray-500">{d.userId}</div>
                </td>
                <td>{d.realName}</td>
                <td>{formatDateTime(d.appliedAt)}</td>
                <td><StatusBadge status={d.status} /></td>
                <td>{d.totalReferrals}</td>
                <td className="text-green-600 font-semibold">
                  ¥{d.totalCommission}
                </td>
                <td>
                  <div className="flex gap-2">
                    {d.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(d.id)}
                      >
                        通过
                      </Button>
                    )}
                    {d.status === 'active' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDisable(d.id)}
                      >
                        禁用
                      </Button>
                    )}
                    <Link href={`/admin/distributors/${d.id}`}>
                      <Button size="sm" variant="outline">详情</Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* 分页 */}
        <Pagination total={data?.total} current={page} onChange={setPage} />
      </div>
    </AdminLayout>
  );
}
```

---

### 2. 分销员详情 `/admin/distributors/[id]`

**页面结构**:
```tsx
export default function DistributorDetailPage({ params }: { params: { id: string } }) {
  const { data: distributor } = useSWR(`/admin/distributors/${params.id}`, fetcher);
  const { data: referrals } = useSWR(`/admin/distributors/${params.id}/referrals`, fetcher);
  const { data: commissions } = useSWR(`/admin/distributors/${params.id}/commissions`, fetcher);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* 基本信息卡片 */}
        <Card>
          <CardHeader>
            <h2>分销员信息</h2>
            <StatusBadge status={distributor?.status} />
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt>真实姓名</dt>
                <dd>{distributor?.realName}</dd>
              </div>
              <div>
                <dt>身份证号</dt>
                <dd>{distributor?.idCard}</dd>
              </div>
              <div>
                <dt>联系方式</dt>
                <dd>{distributor?.contact}</dd>
              </div>
              <div>
                <dt>邀请码</dt>
                <dd className="font-mono font-bold">{distributor?.inviteCode}</dd>
              </div>
              <div>
                <dt>申请时间</dt>
                <dd>{formatDateTime(distributor?.appliedAt)}</dd>
              </div>
              <div>
                <dt>审核时间</dt>
                <dd>{formatDateTime(distributor?.approvedAt)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* 数据统计 */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="推广人数"
            value={distributor?.totalReferrals || 0}
            color="blue"
          />
          <StatCard
            label="累计佣金"
            value={`¥${distributor?.totalCommission || 0}`}
            color="green"
          />
          <StatCard
            label="可提现"
            value={`¥${distributor?.availableCommission || 0}`}
            color="cyan"
          />
          <StatCard
            label="已提现"
            value={`¥${distributor?.withdrawnCommission || 0}`}
            color="purple"
          />
        </div>

        {/* 推广用户列表 */}
        <Card>
          <CardHeader>
            <h3>推广用户列表</h3>
          </CardHeader>
          <CardBody>
            <Table>
              <thead>
                <tr>
                  <th>用户ID</th>
                  <th>手机号</th>
                  <th>注册时间</th>
                  <th>是否购买</th>
                  <th>佣金</th>
                </tr>
              </thead>
              <tbody>
                {referrals?.map(r => (
                  <tr key={r.userId}>
                    <td>{r.userId}</td>
                    <td>{r.phone}</td>
                    <td>{formatDateTime(r.registeredAt)}</td>
                    <td>
                      {r.hasPaid ? (
                        <Badge color="green">已购买</Badge>
                      ) : (
                        <Badge color="gray">未购买</Badge>
                      )}
                    </td>
                    <td className="text-green-600">
                      {r.hasPaid ? `¥${r.commissionAmount}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        {/* 佣金记录 */}
        <Card>
          <CardHeader>
            <h3>佣金记录</h3>
          </CardHeader>
          <CardBody>
            <Table>
              <thead>
                <tr>
                  <th>订单ID</th>
                  <th>订单金额</th>
                  <th>佣金金额</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {commissions?.map(c => (
                  <tr key={c.id}>
                    <td>{c.orderId}</td>
                    <td>¥{c.orderAmount}</td>
                    <td className="text-green-600 font-semibold">
                      ¥{c.commissionAmount}
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{formatDateTime(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
```

---

### 3. 提现审核列表 `/admin/withdrawals`

**页面结构**:
```tsx
export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { data, mutate } = useSWR(`/admin/withdrawals?status=${status}`, fetcher);

  const handleApprove = async (id: string) => {
    if (!confirm('确认审核通过?通过后请尽快线下打款')) {
      return;
    }
    try {
      await api.patch(`/admin/withdrawals/${id}/approve`);
      toast.success('审核通过,请尽快打款');
      mutate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('请输入拒绝原因:');
    if (!reason) return;

    try {
      await api.patch(`/admin/withdrawals/${id}/reject`, {
        rejectReason: reason
      });
      toast.success('已拒绝提现申请');
      mutate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">提现审核</h1>

        {/* 状态Tab */}
        <Tabs value={status} onChange={setStatus}>
          <Tab value="pending">
            待审核 {data?.pending_count && `(${data.pending_count})`}
          </Tab>
          <Tab value="approved">已通过</Tab>
          <Tab value="rejected">已拒绝</Tab>
        </Tabs>

        {/* 提现申请列表 */}
        <div className="mt-6 space-y-4">
          {data?.withdrawals.map(w => (
            <WithdrawalApprovalCard
              key={w.id}
              withdrawal={w}
              onApprove={() => handleApprove(w.id)}
              onReject={() => handleReject(w.id)}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
```

**WithdrawalApprovalCard组件**:
```tsx
export function WithdrawalApprovalCard({ withdrawal, onApprove, onReject }: Props) {
  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-gray-900">
              ¥{withdrawal.amount}
            </div>
            <StatusBadge status={withdrawal.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">分销员:</span>
              <span className="ml-2 font-medium">{withdrawal.distributorName}</span>
            </div>
            <div>
              <span className="text-gray-500">手机号:</span>
              <span className="ml-2 font-medium">{withdrawal.phone}</span>
            </div>
            <div>
              <span className="text-gray-500">提现方式:</span>
              <span className="ml-2">
                {withdrawal.method === 'wechat' ? '微信零钱' : '支付宝'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">收款账号:</span>
              <span className="ml-2 font-mono">{withdrawal.accountInfo.account}</span>
            </div>
            <div>
              <span className="text-gray-500">收款人:</span>
              <span className="ml-2">{withdrawal.accountInfo.name}</span>
            </div>
            <div>
              <span className="text-gray-500">申请时间:</span>
              <span className="ml-2">{formatDateTime(withdrawal.createdAt)}</span>
            </div>
          </div>

          {withdrawal.status === 'rejected' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-sm text-red-600">
                拒绝原因:{withdrawal.rejectReason}
              </div>
            </div>
          )}
        </div>

        {withdrawal.status === 'pending' && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={onApprove}
              className="bg-green-600 text-white"
            >
              通过审核
            </Button>
            <Button
              onClick={onReject}
              variant="outline"
              className="border-red-600 text-red-600"
            >
              拒绝
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 4. 分销数据统计 `/admin/distribution/stats`

**页面结构**:
```tsx
export default function DistributionStatsPage() {
  const { data: stats } = useSWR('/admin/distribution/stats', fetcher);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">分销数据统计</h1>

        {/* 核心数据卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="分销员总数"
            value={stats?.totalDistributors || 0}
            trend="+12"
            color="blue"
          />
          <StatCard
            label="累计推广用户"
            value={stats?.totalReferrals || 0}
            trend="+45"
            color="green"
          />
          <StatCard
            label="累计佣金支出"
            value={`¥${stats?.totalCommissionPaid || 0}`}
            color="orange"
          />
          <StatCard
            label="待审核提现"
            value={`¥${stats?.pendingWithdrawalAmount || 0}`}
            count={stats?.pendingWithdrawals}
            color="red"
          />
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3>推广趋势</h3>
            </CardHeader>
            <CardBody>
              <LineChart data={stats?.referralTrend} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3>佣金支出趋势</h3>
            </CardHeader>
            <CardBody>
              <BarChart data={stats?.commissionTrend} />
            </CardBody>
          </Card>
        </div>

        {/* 分销员排行榜 */}
        <Card>
          <CardHeader>
            <h3>分销员排行榜(本月)</h3>
          </CardHeader>
          <CardBody>
            <Table>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>分销员</th>
                  <th>推广人数</th>
                  <th>本月佣金</th>
                </tr>
              </thead>
              <tbody>
                {stats?.topDistributors.map((d, index) => (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center">
                        {index < 3 && <TrophyIcon className={`text-${['yellow', 'gray', 'orange'][index]}-500`} />}
                        {index + 1}
                      </div>
                    </td>
                    <td>
                      <div>{d.realName}</div>
                      <div className="text-xs text-gray-500">{d.phone}</div>
                    </td>
                    <td>{d.referrals}</td>
                    <td className="text-green-600 font-semibold">
                      ¥{d.commission}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
```

---

### 5. 佣金设置 `/admin/distribution/settings`

**页面结构**:
```tsx
export default function DistributionSettingsPage() {
  const { data: settings } = useSWR('/admin/distribution/settings', fetcher);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: settings
  });

  const onSubmit = async (data) => {
    try {
      await api.put('/admin/distribution/settings', data);
      toast.success('设置已保存');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">佣金设置</h1>

        <Card>
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                label="默认佣金比例(%)"
                required
                error={errors.commissionRate?.message}
              >
                <Input
                  type="number"
                  step="0.1"
                  {...register('commissionRate', {
                    required: '请输入佣金比例',
                    min: { value: 0, message: '不能小于0' },
                    max: { value: 100, message: '不能大于100' }
                  })}
                />
                <div className="text-sm text-gray-500 mt-1">
                  推荐用户购买会员时,分销员获得的佣金百分比(建议10-20%)
                </div>
              </FormField>

              <FormField
                label="最低提现金额(元)"
                required
                error={errors.minWithdrawal?.message}
              >
                <Input
                  type="number"
                  {...register('minWithdrawal', {
                    required: '请输入最低提现金额',
                    min: { value: 1, message: '不能小于1元' }
                  })}
                />
              </FormField>

              <FormField
                label="佣金冻结期(天)"
                required
                error={errors.freezeDays?.message}
              >
                <Input
                  type="number"
                  {...register('freezeDays', {
                    required: '请输入冻结天数',
                    min: { value: 0, message: '不能小于0' }
                  })}
                />
                <div className="text-sm text-gray-500 mt-1">
                  订单支付成功后,佣金冻结天数(防止退款作弊,建议7天)
                </div>
              </FormField>

              <FormField label="自动审核开关">
                <Switch {...register('autoApprove')} />
                <div className="text-sm text-gray-500 mt-1">
                  开启后,符合条件的提现申请将自动通过审核
                </div>
              </FormField>

              <Button type="submit" className="w-full">
                保存设置
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
```

---

## UI设计要求

### 管理后台风格
- 简洁专业,重数据展示
- 表格清晰易读
- 状态标签颜色明确:
  - 待审核:橙色
  - 已激活/已通过:绿色
  - 已禁用/已拒绝:红色

---

## 验证清单

- [ ] 分销员列表正确显示
- [ ] 审核分销员申请功能正常
- [ ] 禁用分销员功能正常
- [ ] 分销员详情数据完整
- [ ] 提现审核功能正常
- [ ] 拒绝提现可输入原因
- [ ] 数据统计卡片正确显示
- [ ] 佣金设置可保存修改

---

**预计工作量**:2天
