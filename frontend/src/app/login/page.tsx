'use client';

import { useEffect, useState } from 'react';
import { Tabs, Form, Input, Button, message, Modal, Typography, Card, Segmented } from 'antd';
import { MobileOutlined, SafetyOutlined, LockOutlined, MailOutlined, GiftOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Text, Title } = Typography;

type PhoneCodeForm = {
  phone: string;
  code: string;
  referralCode?: string;
};

type PhonePasswordForm = {
  phone: string;
  password: string;
};

type EmailCodeForm = {
  email: string;
  code: string;
};

type EmailRegisterForm = {
  email: string;
  code: string;
  password: string;
  referralCode?: string;
};

type SetPasswordForm = {
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  // ========== 邀请码处理 ==========
  const [referralCode, setReferralCode] = useState<string>('');

  // 从 URL 参数读取邀请码
  useEffect(() => {
    const refParam = searchParams?.get('ref') || searchParams?.get('referralCode');
    if (refParam) {
      setReferralCode(refParam);
      // 自动填充到表单
      phoneCodeForm.setFieldsValue({ referralCode: refParam });
      emailRegisterForm.setFieldsValue({ referralCode: refParam });
    }
  }, [searchParams]);

  // ========== 外层：登录/注册模式 ==========
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // ========== 内层：具体方式 ==========
  const [loginMethod, setLoginMethod] = useState<'code' | 'password' | 'email'>('email');
  const [registerMethod, setRegisterMethod] = useState<'phone' | 'email'>('email');

  // ========== 表单实例 ==========
  const [phoneCodeForm] = Form.useForm<PhoneCodeForm>();
  const [phonePasswordForm] = Form.useForm<PhonePasswordForm>();
  const [emailCodeForm] = Form.useForm<EmailCodeForm>();
  const [emailRegisterForm] = Form.useForm<EmailRegisterForm>();
  const [setPasswordForm] = Form.useForm<SetPasswordForm>();

  // ========== 状态管理 ==========
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [phoneCodeCountdown, setPhoneCodeCountdown] = useState(0);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [emailCodeCountdown, setEmailCodeCountdown] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  // ========== 倒计时逻辑 ==========
  useEffect(() => {
    if (phoneCodeCountdown <= 0) return;
    const timer = window.setTimeout(() => setPhoneCodeCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phoneCodeCountdown]);

  useEffect(() => {
    if (emailCodeCountdown <= 0) return;
    const timer = window.setTimeout(() => setEmailCodeCountdown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [emailCodeCountdown]);

  // ========== 发送手机验证码 ==========
  const handleSendPhoneCode = async () => {
    try {
      const phone = phoneCodeForm.getFieldValue('phone');
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        message.error('请输入正确的手机号');
        return;
      }
      setSendingPhoneCode(true);
      const response: any = await api.auth.sendCode(phone);

      if (response?.success === true) {
        message.success('验证码已发送');
        setPhoneCodeCountdown(60);
      } else {
        message.error(response?.error?.message || '验证码发送失败');
      }
    } catch (err: any) {
      message.error(err?.message || '验证码发送失败');
    } finally {
      setSendingPhoneCode(false);
    }
  };

  // ========== 发送邮箱验证码 ==========
  const handleSendEmailCode = async () => {
    try {
      const email = authMode === 'login'
        ? emailCodeForm.getFieldValue('email')
        : emailRegisterForm.getFieldValue('email');

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        message.error('请输入正确的邮箱地址');
        return;
      }
      setSendingEmailCode(true);

      const response: any = await api.auth.sendEmailCode(email);

      if (process.env.NODE_ENV === 'development') {
        console.log('[EmailCode] 响应数据:', response);
      }

      if (response && (response.success === true || response.success === 'true')) {
        message.success('验证码已发送到邮箱，请查收');
        setEmailCodeCountdown(60);
      } else {
        const errorMsg = response?.error?.message || response?.message || '验证码发送失败，请重试';
        if (process.env.NODE_ENV === 'development') {
          console.error('[EmailCode] 发送失败:', { response, errorMsg });
        }
        message.error(errorMsg);
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[EmailCode] 捕获异常:', err);
      }
      const errorMsg = err?.message || err?.error?.message || '网络错误，请检查连接后重试';
      message.error(errorMsg);
    } finally {
      setSendingEmailCode(false);
    }
  };

  // ========== 手机号验证码登录 ==========
  const onPhoneCodeLogin = async (values: PhoneCodeForm) => {
    try {
      setLoginLoading(true);
      const response: any = await api.auth.loginWithCode(values.phone, values.code);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '登录失败，请重试');
      }
      handleLoginSuccess(response.data.data ?? response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  // ========== 手机号密码登录 ==========
  const onPhonePasswordLogin = async (values: PhonePasswordForm) => {
    try {
      setLoginLoading(true);
      const response: any = await api.auth.loginWithPassword(values.phone, values.password);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '登录失败，请检查账号密码');
      }
      handleLoginSuccess(response.data.data ?? response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  // ========== 邮箱验证码登录 ==========
  const onEmailCodeLogin = async (values: EmailCodeForm) => {
    try {
      setLoginLoading(true);
      const response: any = await api.auth.loginWithEmail(values.email, values.code);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '登录失败，请重试');
      }
      handleLoginSuccess(response.data.data ?? response.data);
    } catch (err: any) {
      message.error(err?.message || '登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  // ========== 手机号验证码注册 ==========
  const onPhoneRegister = async (values: PhoneCodeForm) => {
    try {
      setRegisterLoading(true);
      // 注意：验证码登录接口支持自动注册，传递邀请码
      const response: any = await api.auth.loginWithCode(
        values.phone,
        values.code,
        values.referralCode || null  // 传递邀请码
      );
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '注册失败，请重试');
      }
      handleLoginSuccess(response.data.data ?? response.data, true);
    } catch (err: any) {
      message.error(err?.message || '注册失败，请重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  // ========== 邮箱+验证码+密码注册 ==========
  const onEmailRegister = async (values: EmailRegisterForm) => {
    try {
      setRegisterLoading(true);
      const response: any = await api.auth.registerWithEmail(
        values.email,
        values.code,
        values.password,
        values.referralCode || null  // 传递邀请码
      );
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || '注册失败，请重试');
      }
      handleLoginSuccess(response.data.data ?? response.data, true);
    } catch (err: any) {
      message.error(err?.message || '注册失败，请重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  // ========== 登录/注册成功处理 ==========
  const handleLoginSuccess = (payload: any, isRegister: boolean = false) => {
    if (!payload) {
      message.error('登录失败，未获取到登录信息');
      return;
    }

    const accessToken = payload.accessToken || payload.token || payload.access_token || null;
    const refreshToken = payload.refreshToken || payload.refresh_token || null;
    const user = payload.user || null;

    if (!accessToken) {
      message.error('登录失败，缺少访问凭证');
      return;
    }

    setAuth(user, accessToken, refreshToken);

    if (isRegister || payload.needSetPassword || user?.hasPassword === false) {
      message.success(isRegister ? '注册成功！建议设置密码以便后续快捷登录' : '登录成功，请设置密码');
      setPwdModalOpen(true);
    } else {
      message.success(isRegister ? '注册成功！' : '登录成功');
      router.push('/workspace');
    }
  };

  // ========== 设置密码 ==========
  const onSetPassword = async (values: SetPasswordForm) => {
    try {
      setSettingPassword(true);
      const response: any = await api.auth.setPassword(values.password);
      if (response.data?.success === false) {
        throw new Error(response.data?.error?.message || '密码设置失败');
      }
      message.success(response.data?.message || '密码设置成功');
      setPwdModalOpen(false);
      router.push('/workspace');
    } catch (err: any) {
      message.error(err?.message || '密码设置失败，请重试');
    } finally {
      setSettingPassword(false);
    }
  };

  // ========== 渲染登录表单 ==========
  const renderLoginForms = () => {
    const items = [
      {
        key: 'code',
        label: '验证码',
        children: (
          <Form layout="vertical" form={phoneCodeForm} onFinish={onPhoneCodeLogin} autoComplete="off">
            <Form.Item
              name="phone"
              label="手机号"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input prefix={<MobileOutlined />} placeholder="请输入手机号" maxLength={11} />
            </Form.Item>

            <Form.Item
              name="code"
              label="验证码"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <Input prefix={<SafetyOutlined />} placeholder="请输入6位验证码" maxLength={6} />
            </Form.Item>

            <Form.Item>
              <Button
                block
                onClick={handleSendPhoneCode}
                disabled={phoneCodeCountdown > 0}
                loading={sendingPhoneCode}
              >
                {phoneCodeCountdown > 0 ? `${phoneCodeCountdown}秒后重试` : '获取验证码'}
              </Button>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loginLoading} block>
                登录
              </Button>
            </Form.Item>
          </Form>
        ),
      },
      {
        key: 'password',
        label: '密码',
        children: (
          <Form layout="vertical" form={phonePasswordForm} onFinish={onPhonePasswordLogin} autoComplete="off">
            <Form.Item
              name="phone"
              label="手机号"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input prefix={<MobileOutlined />} placeholder="请输入手机号" maxLength={11} />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码不少于6位' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loginLoading} block>
                登录
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'right' }}>
              <Button type="link" href="/reset-password" style={{ padding: 0 }}>
                忘记密码？
              </Button>
            </div>
          </Form>
        ),
      },
      {
        key: 'email',
        label: '邮箱',
        children: (
          <Form layout="vertical" form={emailCodeForm} onFinish={onEmailCodeLogin} autoComplete="off">
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入正确的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" />
            </Form.Item>

            <Form.Item
              name="code"
              label="验证码"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <Input prefix={<SafetyOutlined />} placeholder="请输入6位验证码" maxLength={6} />
            </Form.Item>

            <Form.Item>
              <Button
                block
                onClick={handleSendEmailCode}
                disabled={emailCodeCountdown > 0}
                loading={sendingEmailCode}
              >
                {emailCodeCountdown > 0 ? `${emailCodeCountdown}秒后重试` : '获取验证码'}
              </Button>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loginLoading} block>
                登录
              </Button>
            </Form.Item>
          </Form>
        ),
      },
    ];

    return <Tabs activeKey={loginMethod} onChange={(key: any) => setLoginMethod(key)} items={items} />;
  };

  // ========== 渲染注册表单 ==========
  const renderRegisterForms = () => {
    const items = [
      {
        key: 'phone',
        label: '手机号注册',
        children: (
          <Form layout="vertical" form={phoneCodeForm} onFinish={onPhoneRegister} autoComplete="off">
            <Form.Item
              name="phone"
              label="手机号"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input prefix={<MobileOutlined />} placeholder="请输入手机号" maxLength={11} />
            </Form.Item>

            <Form.Item
              name="code"
              label="验证码"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <Input prefix={<SafetyOutlined />} placeholder="请输入6位验证码" maxLength={6} />
            </Form.Item>

            <Form.Item>
              <Button
                block
                onClick={handleSendPhoneCode}
                disabled={phoneCodeCountdown > 0}
                loading={sendingPhoneCode}
              >
                {phoneCodeCountdown > 0 ? `${phoneCodeCountdown}秒后重试` : '获取验证码'}
              </Button>
            </Form.Item>

            <Form.Item
              name="referralCode"
              label="邀请码（可选）"
            >
              <Input prefix={<GiftOutlined />} placeholder="请输入邀请码（选填）" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={registerLoading} block>
                注册
              </Button>
            </Form.Item>

            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                注册成功后可以选择设置密码，方便下次快捷登录
              </Text>
            </div>
          </Form>
        ),
      },
      {
        key: 'email',
        label: '邮箱注册',
        children: (
          <Form layout="vertical" form={emailRegisterForm} onFinish={onEmailRegister} autoComplete="off">
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入正确的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" />
            </Form.Item>

            <Form.Item
              name="code"
              label="验证码"
              rules={[
                { required: true, message: '请输入验证码' },
                { pattern: /^\d{6}$/, message: '验证码为6位数字' },
              ]}
            >
              <Input prefix={<SafetyOutlined />} placeholder="请输入6位验证码" maxLength={6} />
            </Form.Item>

            <Form.Item>
              <Button
                block
                onClick={handleSendEmailCode}
                disabled={emailCodeCountdown > 0}
                loading={sendingEmailCode}
              >
                {emailCodeCountdown > 0 ? `${emailCodeCountdown}秒后重试` : '获取验证码'}
              </Button>
            </Form.Item>

            <Form.Item
              name="password"
              label="设置密码"
              rules={[
                { required: true, message: '请设置密码' },
                { min: 6, message: '密码不少于6位' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请设置至少6位的密码" />
            </Form.Item>

            <Form.Item
              name="referralCode"
              label="邀请码（可选）"
            >
              <Input prefix={<GiftOutlined />} placeholder="请输入邀请码（选填）" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={registerLoading} block>
                注册
              </Button>
            </Form.Item>
          </Form>
        ),
      },
    ];

    return <Tabs activeKey={registerMethod} onChange={(key: any) => setRegisterMethod(key)} items={items} />;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#F9FAFB',
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '420px',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
          borderRadius: '12px',
        }}
        bodyStyle={{ padding: 32 }}
      >
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            AI服装处理平台
          </Title>
          <Text type="secondary">快速开始您的AI服装处理之旅</Text>
        </div>

        {/* 登录/注册模式切换 */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <Segmented
            options={[
              { label: '登录', value: 'login' },
              { label: '注册', value: 'register' },
            ]}
            value={authMode}
            onChange={(value) => setAuthMode(value as 'login' | 'register')}
            size="large"
            style={{ fontWeight: 500 }}
          />
        </div>

        {/* 表单区域 */}
        {authMode === 'login' ? renderLoginForms() : renderRegisterForms()}

        {/* 底部切换提示 */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {authMode === 'login' ? (
            <Text type="secondary">
              还没有账号？
              <Button type="link" onClick={() => setAuthMode('register')} style={{ padding: '0 4px' }}>
                立即注册
              </Button>
            </Text>
          ) : (
            <Text type="secondary">
              已有账号？
              <Button type="link" onClick={() => setAuthMode('login')} style={{ padding: '0 4px' }}>
                去登录
              </Button>
            </Text>
          )}
        </div>

        {/* 用户协议 */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {authMode === 'login' ? '登录' : '注册'}即代表同意
            <a href="/legal/terms" style={{ color: '#92400E' }}>
              {' '}
              用户协议{' '}
            </a>
            和
            <a href="/legal/privacy" style={{ color: '#92400E' }}>
              {' '}
              隐私政策
            </a>
          </Text>
        </div>

        {/* 提示信息 */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: '#F9FAFB',
            borderRadius: '8px',
          }}
        >
          <Text type="secondary" style={{ fontSize: '13px' }}>
            <strong>温馨提示:</strong>
            <br />
            • 验证码1分钟内最多发送5次
            <br />
            {authMode === 'register' && '• 新用户注册即赠送3次免费体验'}
            {authMode === 'login' && '• 首次登录的新用户将自动注册账号'}
          </Text>
        </div>
      </Card>

      {/* 设置密码弹窗 */}
      <Modal title="设置密码" open={pwdModalOpen} onCancel={() => setPwdModalOpen(false)} footer={null} destroyOnClose>
        <Text type="secondary">建议设置密码，之后可直接使用密码快捷登录。</Text>
        <Form layout="vertical" form={setPasswordForm} onFinish={onSetPassword} style={{ marginTop: 16 }}>
          <Form.Item
            name="password"
            label="设置新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码不少于6位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入至少6位的密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={settingPassword} block>
            保存
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
