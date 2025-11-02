'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, InputNumber, Switch, Button, Card, message, Spin } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * 分销设置类型定义
 */
interface DistributionSettings {
  commissionRate: number;
  minWithdrawal: number;
  freezeDays: number;
  autoApprove: boolean;
}

/**
 * 管理端 - 分销设置页面
 *
 * 艹！管理员在这里配置整个分销系统的参数！
 */
export default function DistributionSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<DistributionSettings | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/workspace');
      return;
    }

    fetchSettings();
  }, [user, router]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response: any = await api.adminDistribution.getSettings();

      if (response.success && response.data) {
        setSettings(response.data);
        form.setFieldsValue(response.data);
      }
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: DistributionSettings) => {
    try {
      setSubmitting(true);

      // 参数校验
      if (values.commissionRate <= 0 || values.commissionRate >= 1) {
        message.error('佣金比例必须在0-1之间（例如：0.1表示10%）');
        return;
      }

      if (values.minWithdrawal < 0) {
        message.error('最低提现金额不能为负数');
        return;
      }

      if (values.freezeDays < 0) {
        message.error('佣金冻结天数不能为负数');
        return;
      }

      const response: any = await api.adminDistribution.updateSettings(values);

      if (response.success) {
        message.success('设置保存成功');
        setSettings(values);
      } else {
        message.error(response.error?.message || '保存失败');
      }
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        分销设置
      </h1>

      <Card style={{ maxWidth: '800px' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={settings || {
            commissionRate: 0.1,
            minWithdrawal: 100,
            freezeDays: 15,
            autoApprove: false
          }}
        >
          {/* 佣金比例 */}
          <Form.Item
            name="commissionRate"
            label="佣金比例"
            tooltip="推广用户付费后，分销员可获得的佣金比例（例如：0.1表示10%）"
            rules={[
              { required: true, message: '请输入佣金比例' },
              {
                validator: (_, value) => {
                  if (value <= 0 || value >= 1) {
                    return Promise.reject('佣金比例必须在0-1之间');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <InputNumber
              min={0.01}
              max={0.99}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              placeholder="例如：0.1表示10%佣金"
              addonAfter={
                settings && (
                  <span style={{ color: '#10b981', fontWeight: '500' }}>
                    {(settings.commissionRate * 100).toFixed(0)}%
                  </span>
                )
              }
            />
          </Form.Item>

          {/* 最低提现金额 */}
          <Form.Item
            name="minWithdrawal"
            label="最低提现金额（元）"
            tooltip="分销员发起提现申请的最低金额限制"
            rules={[
              { required: true, message: '请输入最低提现金额' },
              {
                validator: (_, value) => {
                  if (value < 0) {
                    return Promise.reject('最低提现金额不能为负数');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <InputNumber
              min={0}
              step={10}
              precision={2}
              style={{ width: '100%' }}
              placeholder="例如：100表示最低提现¥100"
              addonBefore="¥"
            />
          </Form.Item>

          {/* 佣金冻结天数 */}
          <Form.Item
            name="freezeDays"
            label="佣金冻结天数"
            tooltip="订单完成后，佣金需要冻结多少天才能提现（防止退款）"
            rules={[
              { required: true, message: '请输入佣金冻结天数' },
              {
                validator: (_, value) => {
                  if (value < 0) {
                    return Promise.reject('佣金冻结天数不能为负数');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <InputNumber
              min={0}
              max={90}
              step={1}
              precision={0}
              style={{ width: '100%' }}
              placeholder="例如：15表示订单完成后15天可提现"
              addonAfter="天"
            />
          </Form.Item>

          {/* 自动审核 */}
          <Form.Item
            name="autoApprove"
            label="自动审核分销员申请"
            tooltip="开启后，分销员申请将自动通过，无需人工审核"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </Form.Item>

          {/* 提交按钮 */}
          <Form.Item style={{ marginBottom: 0, marginTop: '32px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={submitting}
              size="large"
            >
              {submitting ? '保存中...' : '保存设置'}
            </Button>
            <Button
              style={{ marginLeft: '12px' }}
              onClick={() => form.resetFields()}
              disabled={submitting}
              size="large"
            >
              重置
            </Button>
          </Form.Item>
        </Form>

        {/* 当前生效配置展示 */}
        {settings && (
          <div
            style={{
              marginTop: '32px',
              padding: '16px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #cbd5e1'
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#475569' }}>
              当前生效配置
            </h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>佣金比例：</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>
                  {(settings.commissionRate * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>最低提现：</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>
                  ¥{settings.minWithdrawal.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>冻结天数：</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>
                  {settings.freezeDays}天
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>自动审核：</span>
                <span
                  style={{
                    fontWeight: '600',
                    color: settings.autoApprove ? '#10b981' : '#ef4444'
                  }}
                >
                  {settings.autoApprove ? '已开启' : '已关闭'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 温馨提示 */}
        <div
          style={{
            marginTop: '24px',
            padding: '12px 16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px'
          }}
        >
          <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: '1.6' }}>
            ⚠️ 温馨提示：修改分销设置将立即生效，影响所有分销员和新订单的佣金计算。
            请谨慎操作，确保参数设置合理。建议在修改前备份当前配置。
          </p>
        </div>
      </Card>
    </div>
  );
}
