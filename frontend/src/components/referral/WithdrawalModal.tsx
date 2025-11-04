/**
 * 提现申请Modal组件
 * 艹！这个Modal让用户填写提现信息！
 *
 * @author 老王
 */

import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Alert } from 'antd';
import { WalletOutlined } from '@ant-design/icons';

/**
 * WithdrawalModal Props
 */
interface WithdrawalModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  availableBalance: number; // 可提现余额
}

/**
 * 提现表单数据
 */
interface WithdrawalFormData {
  amount: number; // 提现金额
  payment_method: 'wechat' | 'alipay' | 'bank'; // 提现方式
  payment_account: string; // 提现账号
  real_name: string; // 真实姓名
  bank_name?: string; // 银行名称（仅银行卡需要）
}

/**
 * 提现申请Modal
 */
export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  open,
  onClose,
  onSuccess,
  availableBalance,
}) => {
  const [form] = Form.useForm<WithdrawalFormData>();
  const [loading, setLoading] = useState(false);

  // 监听提现方式变化
  const paymentMethod = Form.useWatch('payment_method', form);

  /**
   * 提交提现申请
   */
  const handleSubmit = async (values: WithdrawalFormData) => {
    setLoading(true);

    try {
      const response = await fetch('/api/referral/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(`提现申请失败: ${response.status}`);
      }

      const data = await response.json();

      message.success('提现申请已提交，请等待审核');
      form.resetFields();
      onClose();

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('[提现申请] 提交失败:', error);
      message.error(error.message || '提现申请失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 取消
   */
  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <span>
          <WalletOutlined style={{ marginRight: 8 }} />
          申请提现
        </span>
      }
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="提交申请"
      cancelText="取消"
      width={600}
    >
      <Alert
        message={`可提现余额: ¥${availableBalance.toFixed(2)}`}
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          payment_method: 'alipay',
        }}
      >
        {/* 提现金额 */}
        <Form.Item
          label="提现金额"
          name="amount"
          rules={[
            { required: true, message: '请输入提现金额' },
            {
              validator: async (_, value) => {
                if (value < 100) {
                  throw new Error('最低提现金额为100元');
                }
                if (value > availableBalance) {
                  throw new Error('提现金额不能超过可提现余额');
                }
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={100}
            max={availableBalance}
            precision={2}
            prefix="¥"
            placeholder="请输入提现金额（最低100元）"
          />
        </Form.Item>

        {/* 提现方式 */}
        <Form.Item
          label="提现方式"
          name="payment_method"
          rules={[{ required: true, message: '请选择提现方式' }]}
        >
          <Select
            options={[
              { label: '支付宝', value: 'alipay' },
              { label: '微信', value: 'wechat' },
              { label: '银行卡', value: 'bank' },
            ]}
          />
        </Form.Item>

        {/* 真实姓名 */}
        <Form.Item
          label="真实姓名"
          name="real_name"
          rules={[{ required: true, message: '请输入真实姓名' }]}
        >
          <Input placeholder="请输入真实姓名" />
        </Form.Item>

        {/* 支付宝账号 */}
        {paymentMethod === 'alipay' && (
          <Form.Item
            label="支付宝账号"
            name="payment_account"
            rules={[
              { required: true, message: '请输入支付宝账号' },
              {
                pattern: /^1[3-9]\d{9}$|^[\w\.-]+@[\w\.-]+\.\w+$/,
                message: '请输入正确的手机号或邮箱',
              },
            ]}
          >
            <Input placeholder="请输入支付宝账号（手机号或邮箱）" />
          </Form.Item>
        )}

        {/* 微信账号 */}
        {paymentMethod === 'wechat' && (
          <Form.Item
            label="微信账号"
            name="payment_account"
            rules={[{ required: true, message: '请输入微信账号' }]}
          >
            <Input placeholder="请输入微信账号" />
          </Form.Item>
        )}

        {/* 银行卡信息 */}
        {paymentMethod === 'bank' && (
          <>
            <Form.Item
              label="银行名称"
              name="bank_name"
              rules={[{ required: true, message: '请输入银行名称' }]}
            >
              <Input placeholder="例如：中国工商银行" />
            </Form.Item>

            <Form.Item
              label="银行卡号"
              name="payment_account"
              rules={[
                { required: true, message: '请输入银行卡号' },
                {
                  pattern: /^\d{16,19}$/,
                  message: '请输入正确的银行卡号（16-19位数字）',
                },
              ]}
            >
              <Input placeholder="请输入银行卡号" maxLength={19} />
            </Form.Item>
          </>
        )}
      </Form>

      {/* 温馨提示 */}
      <Alert
        message="温馨提示"
        description={
          <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
            <li>提现申请提交后，将在1-3个工作日内审核</li>
            <li>审核通过后，款项将在3个工作日内到账</li>
            <li>请确保提现账号信息准确无误，否则可能导致提现失败</li>
          </ul>
        }
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
      />
    </Modal>
  );
};
