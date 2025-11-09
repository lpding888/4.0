'use client';

import { useEffect, useState } from 'react';
import { Tabs, Form, Input, Button, message, Modal, Typography, Card } from 'antd';
import { MobileOutlined, SafetyOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Text, Title } = Typography;

type CodeLoginForm = {
  phone: string;
  code: string;
};

type PasswordLoginForm = {
  phone: string;
  password: string;
};

type SetPasswordForm = {
  password: string;
};

export default function LoginPage() {
  const [codeForm] = Form.useForm<CodeLoginForm>();
  const [passwordForm] = Form.useForm<PasswordLoginForm>();
  const [setPasswordForm] = Form.useForm<SetPasswordForm>();

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeLoading, setCodeLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  const handleSendCode = async () => {
    try {
      const phone = codeForm.getFieldValue('phone');
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        message.error('请输入正确的手机号');
        return;
      }
      setSendingCode(true);
      const response: any = await api.auth.sendCode(phone);
      if (response?.success) {
        message.success('验证码已发送');
        setCodeCountdown(60);
      } else {
        message.error(response?.error?.message || '验证码发送失败');
      }
    } catch (err: any) {
      message.error(err?.message || '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const onCodeLogin = async (values: CodeLoginForm) => {
    try {
      setCodeLoading(true);
      const response: any = await api.auth.loginWithCode(values.phone, values.code);
      if (!response?.success) {
        throw new Error(response?.error?.message || '登录失败，请重试');
      }
      handleLoginSuccess(response.data ?? response);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setCodeLoading(false);
    }
  };

  const onPasswordLogin = async (values: PasswordLoginForm) => {
    try {
      setPasswordLoading(true);
      const response: any = await api.auth.loginWithPassword(values.phone, values.password);
      if (!response?.success) {
        throw new Error(response?.error?.message || '登录失败，请检查账号密码');
      }
      handleLoginSuccess(response.data ?? response);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLoginSuccess = (payload: any) => {
    if (!payload) {
      message.error('登录失败，未获取到登录信息');
      return;
    }

    const accessToken =
      payload.accessToken ||
      payload.token ||
      payload.access_token ||
      null;
    const refreshToken =
      payload.refreshToken ||
      payload.refresh_token ||
      null;
    const user = payload.user || null;

    if (!accessToken) {
      message.error('登录失败，缺少访问凭证');
      return;
    }

    setAuth(user, accessToken, refreshToken);

    if (payload.needSetPassword || user?.hasPassword === false) {
      message.success('登录成功，请设置密码');
      setPwdModalOpen(true);
    } else {
      message.success('登录成功');
      router.push('/workspace');
    }
  };

  const onSetPassword = async (values: SetPasswordForm) => {
    try {
      setSettingPassword(true);
      const response: any = await api.auth.setPassword(values.password);
      if (response?.success === false) {
        throw new Error(response?.error?.message || '密码设置失败');
      }
      message.success(response?.message || '密码设置成功');
      setPasswordForm.resetFields();
      setPwdModalOpen(false);
      router.push('/workspace');
    } catch (err: any) {
      message.error(err?.message || '密码设置失败，请重试');
    } finally {
      setSettingPassword(false);
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
        bodyStyle={{ padding: 32 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            AI服装处理平台
          </Title>
          <Text type="secondary">验证码 / 密码任你选，首次登录可立即设置密码</Text>
        </div>

        <Tabs
          activeKey={mode}
          onChange={(key) => setMode(key as 'code' | 'password')}
          items={[
            {
              key: 'code',
              label: '验证码登录',
              children: (
                <Form
                  layout="vertical"
                  form={codeForm}
                  onFinish={onCodeLogin}
                  autoComplete="off"
                >
                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      {
                        pattern: /^1[3-9]\d{9}$/,
                        message: '请输入正确的手机号',
                      },
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
                    label="验证码"
                    rules={[
                      { required: true, message: '请输入验证码' },
                      {
                        pattern: /^\d{6}$/,
                        message: '验证码为6位数字',
                      },
                    ]}
                  >
                    <Input
                      prefix={<SafetyOutlined />}
                      placeholder="请输入6位验证码"
                      maxLength={6}
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      block
                      onClick={handleSendCode}
                      disabled={codeCountdown > 0}
                      loading={sendingCode}
                    >
                      {codeCountdown > 0
                        ? `${codeCountdown}秒后重试`
                        : '获取验证码'}
                    </Button>
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={codeLoading}
                      block
                    >
                      登录
                    </Button>
                  </Form.Item>

                  <div style={{ textAlign: 'right' }}>
                    <Button
                      type="link"
                      onClick={() => setMode('password')}
                      style={{ padding: 0 }}
                    >
                      使用密码登录
                    </Button>
                  </div>
                </Form>
              ),
            },
            {
              key: 'password',
              label: '密码登录',
              children: (
                <Form
                  layout="vertical"
                  form={passwordForm}
                  onFinish={onPasswordLogin}
                  autoComplete="off"
                >
                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[
                      { required: true, message: '请输入手机号' },
                      {
                        pattern: /^1[3-9]\d{9}$/,
                        message: '请输入正确的手机号',
                      },
                    ]}
                  >
                    <Input
                      prefix={<MobileOutlined />}
                      placeholder="请输入手机号"
                      maxLength={11}
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码不少于6位' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="请输入密码"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={passwordLoading}
                      block
                    >
                      登录
                    </Button>
                  </Form.Item>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      type="link"
                      onClick={() => setMode('code')}
                      style={{ padding: 0 }}
                    >
                      使用验证码登录
                    </Button>
                    <Button type="link" href="/reset-password" style={{ padding: 0 }}>
                      忘记密码？
                    </Button>
                  </div>
                </Form>
              ),
            },
          ]}
        />

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            登录即代表同意
            <a href="/legal/terms" style={{ color: '#92400E' }}> 用户协议 </a>
            和
            <a href="/legal/privacy" style={{ color: '#92400E' }}> 隐私政策</a>
          </Text>
        </div>

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

      <Modal
        title="设置密码"
        open={pwdModalOpen}
        onCancel={() => setPwdModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Text type="secondary">
          首次登录建议设置密码，之后可直接使用密码快捷登录。
        </Text>
        <Form
          layout="vertical"
          form={setPasswordForm}
          onFinish={onSetPassword}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="password"
            label="设置新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码不少于6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入至少6位的密码"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={settingPassword}
            block
          >
            保存
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
