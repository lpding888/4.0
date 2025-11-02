'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, message, Card, Typography } from 'antd';
import { MobileOutlined, SafetyOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [form] = Form.useForm();
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  // 发送验证码
  const handleSendCode = async () => {
    try {
      const phone = form.getFieldValue('phone');
      
      // 验证手机号
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        message.error('请输入正确的手机号');
        return;
      }

      setSendingCode(true);
      
      const response: any = await api.auth.sendCode(phone);
      
      if (response.success) {
        message.success('验证码已发送');
        // 开始60秒倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        message.error(response.error?.message || '发送失败');
      }
    } catch (error: any) {
      message.error(error.message || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  // 登录
  const handleLogin = async (values: { phone: string; code: string }) => {
    try {
      setLoading(true);
      
      const response: any = await api.auth.login(values.phone, values.code);
      
      if (response.success && response.data) {
        const { token, user } = response.data;

        // 老王我给你优化一下，不用重复保存，setAuth已经处理了
        // 更新全局状态
        setAuth(user, token);

        message.success('登录成功');

        // 跳转到工作台
        router.push('/workspace');
      } else {
        message.error(response.error?.message || '登录失败');
      }
    } catch (error: any) {
      message.error(error.message || '登录失败,请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#F9FAFB',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '400px',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
          borderRadius: '12px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2} style={{ marginBottom: '8px' }}>
            AI服装处理平台
          </Title>
          <Text type="secondary">
            手机号验证码登录/注册
          </Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { 
                pattern: /^1[3-9]\d{9}$/, 
                message: '请输入正确的手机号' 
              }
            ]}
          >
            <Input
              prefix={<MobileOutlined />}
              placeholder="请输入手机号"
              maxLength={11}
            />
          </Form.Item>

          <Form.Item
            name="code"
            rules={[
              { required: true, message: '请输入验证码' },
              { 
                pattern: /^\d{6}$/, 
                message: '验证码为6位数字' 
              }
            ]}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input
                prefix={<SafetyOutlined />}
                placeholder="请输入6位验证码"
                maxLength={6}
                style={{ flex: 1 }}
              />
              <Button
                onClick={handleSendCode}
                disabled={countdown > 0}
                loading={sendingCode}
                style={{ width: '120px' }}
              >
                {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
              </Button>
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: '44px' }}
            >
              登录 / 注册
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              登录即代表同意
              <a href="#" style={{ color: '#92400E' }}> 用户协议 </a>
              和
              <a href="#" style={{ color: '#92400E' }}> 隐私政策</a>
            </Text>
          </div>
        </Form>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#F9FAFB',
          borderRadius: '8px'
        }}>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            <strong>提示:</strong>
            <br />
            • 验证码1分钟内最多发送5次
            <br />
            • 首次登录将自动注册账号
            <br />
            • 新用户赠送3次免费体验
          </Text>
        </div>
      </Card>
    </div>
  );
}
