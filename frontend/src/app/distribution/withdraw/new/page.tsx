'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Radio, Button, message, Spin } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { DistributionDashboard } from '@/types';

/**
 * 申请提现页面
 *
 * 艹！用户申请提现佣金！必须校验金额！
 */
export default function WithdrawNewPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dashboard, setDashboard] = useState<DistributionDashboard | null>(null);
  const [method, setMethod] = useState<'wechat' | 'alipay'>('wechat');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchDashboard();
  }, [user, router]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response: any = await api.distribution.getDashboard();

      if (response.success && response.data) {
        setDashboard(response.data);
      }
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      // 校验金额
      const amount = parseFloat(values.amount);
      if (amount < 100) {
        message.error('提现金额不能低于¥100');
        return;
      }

      if (amount > (dashboard?.availableCommission || 0)) {
        message.error('提现金额不能超过可提现余额');
        return;
      }

      setSubmitting(true);

      const response: any = await api.distribution.createWithdrawal({
        amount,
        method,
        accountInfo: {
          account: values.account,
          name: values.name
        }
      });

      if (response.success) {
        message.success('提现申请已提交，请等待审核');
        router.push('/distribution/withdrawals');
      } else {
        message.error(response.error?.message || '提现申请失败');
      }
    } catch (error: any) {
      message.error(error.message || '提现申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="
          min-h-screen
          bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
          flex items-center justify-center
        "
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
        py-12 px-4
      "
    >
      <div className="container mx-auto max-w-2xl">
        <h1 className="text-4xl font-light text-white mb-8 text-center">
          申请提现
        </h1>

        <div
          className="
            backdrop-blur-md bg-white/5
            border border-white/10
            rounded-2xl shadow-2xl
            p-8
          "
        >
          {/* 可提现金额展示 */}
          <div
            className="
              mb-8 p-6
              bg-green-500/10 border border-green-400/30
              rounded-lg text-center
            "
          >
            <div className="text-sm text-white/60 mb-2">可提现金额</div>
            <div className="text-5xl font-bold text-green-400">
              ¥{(dashboard?.availableCommission || 0).toFixed(2)}
            </div>
          </div>

          {/* 提现表单 */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
          >
            {/* 提现金额 */}
            <Form.Item
              name="amount"
              label={<span className="text-white/80">提现金额</span>}
              rules={[
                { required: true, message: '请输入提现金额' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const num = parseFloat(value);
                    if (isNaN(num) || num < 100) {
                      return Promise.reject('最低提现¥100');
                    }
                    if (num > (dashboard?.availableCommission || 0)) {
                      return Promise.reject('超过可提现余额');
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                type="number"
                step="0.01"
                placeholder="最低¥100"
                prefix="¥"
                className="
                  h-12
                  bg-white/10 border-white/20
                  text-white placeholder:text-white/40
                "
              />
            </Form.Item>

            {/* 提现方式 */}
            <Form.Item
              name="method"
              label={<span className="text-white/80">提现方式</span>}
              initialValue="wechat"
            >
              <Radio.Group
                onChange={(e) => setMethod(e.target.value)}
                className="flex gap-4"
              >
                <Radio value="wechat" className="text-white">
                  微信零钱
                </Radio>
                <Radio value="alipay" className="text-white">
                  支付宝
                </Radio>
              </Radio.Group>
            </Form.Item>

            {/* 收款账号 */}
            <Form.Item
              name="account"
              label={
                <span className="text-white/80">
                  {method === 'wechat' ? '微信账号' : '支付宝账号'}
                </span>
              }
              rules={[
                { required: true, message: `请输入${method === 'wechat' ? '微信' : '支付宝'}账号` }
              ]}
            >
              <Input
                placeholder={`请输入${method === 'wechat' ? '微信号' : '支付宝账号'}`}
                className="
                  h-12
                  bg-white/10 border-white/20
                  text-white placeholder:text-white/40
                "
              />
            </Form.Item>

            {/* 收款人姓名 */}
            <Form.Item
              name="name"
              label={<span className="text-white/80">收款人姓名</span>}
              rules={[{ required: true, message: '请输入真实姓名' }]}
            >
              <Input
                placeholder="请输入与账号匹配的真实姓名"
                className="
                  h-12
                  bg-white/10 border-white/20
                  text-white placeholder:text-white/40
                "
              />
            </Form.Item>

            {/* 提交按钮 */}
            <Form.Item className="mb-0 mt-6">
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                disabled={submitting}
                className="
                  w-full h-12
                  bg-gradient-to-r from-green-500 to-emerald-500
                  border-0
                  text-white font-semibold text-base
                "
              >
                {submitting ? '提交中...' : '提交提现申请'}
              </Button>
            </Form.Item>
          </Form>

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-xs text-white/60 leading-relaxed">
              温馨提示：提现申请提交后，我们将在1-3个工作日内完成审核。
              审核通过后，款项将在24小时内打入您的账户。
              请确保填写的账号信息准确无误。
            </p>
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/distribution/dashboard')}
            className="
              text-cyan-400 text-sm
              hover:text-cyan-300
              transition-colors duration-300
            "
          >
            ← 返回分销中心
          </button>
        </div>
      </div>
    </div>
  );
}
