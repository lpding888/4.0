'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, message } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { TextArea } = Input;

/**
 * 分销员申请页
 *
 * 艹！这个页面让用户填写资料申请成为分销员！
 * 必须遵循青蓝玻璃拟态主题！
 */
export default function DistributionApplyPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 检查登录
  if (!user) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return null;
  }

  // 提交申请
  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      const response: any = await api.distribution.apply({
        realName: values.realName,
        idCard: values.idCard,
        contact: values.contact,
        channel: values.channel
      });

      if (response.success) {
        message.success('申请已提交，请等待审核');
        router.push('/workspace');
      } else {
        message.error(response.error?.message || '申请失败');
      }
    } catch (error: any) {
      message.error(error.message || '申请失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
        py-12 px-4
      "
    >
      <div className="container mx-auto max-w-2xl">
        {/* 标题 */}
        <h1 className="text-4xl font-light text-white mb-8 text-center">
          申请成为分销员
        </h1>

        {/* 主卡片 */}
        <div
          className="
            backdrop-blur-md bg-white/5
            border border-white/10
            rounded-2xl shadow-2xl
            p-8
          "
        >
          {/* 福利说明 */}
          <div
            className="
              mb-8 p-4
              bg-cyan-500/10 border border-cyan-400/30
              rounded-lg
            "
          >
            <h3 className="text-cyan-400 text-lg font-semibold mb-3">
              分销员福利
            </h3>
            <ul className="text-white/80 space-y-2 text-sm">
              <li>✅ 每推荐1位新用户购买会员，赚取15%佣金</li>
              <li>✅ 佣金可随时提现，单笔最低¥100</li>
              <li>✅ 无限推广，收益无上限</li>
              <li>✅ 专属邀请码和推广链接</li>
            </ul>
          </div>

          {/* 申请表单 */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
          >
            {/* 真实姓名 */}
            <Form.Item
              name="realName"
              label={<span className="text-white/80">真实姓名</span>}
              rules={[{ required: true, message: '请输入真实姓名' }]}
            >
              <Input
                placeholder="请输入真实姓名"
                className="
                  h-12
                  bg-white/10 border-white/20
                  text-white placeholder:text-white/40
                  hover:bg-white/15 hover:border-cyan-400/50
                  focus:bg-white/15 focus:border-cyan-400
                "
              />
            </Form.Item>

            {/* 身份证号 */}
            <Form.Item
              name="idCard"
              label={<span className="text-white/80">身份证号</span>}
              rules={[
                { required: true, message: '请输入身份证号' },
                {
                  pattern: /^\d{17}[\dXx]$/,
                  message: '身份证号格式不正确'
                }
              ]}
            >
              <Input
                placeholder="请输入18位身份证号"
                maxLength={18}
                className="
                  h-12
                  bg-white/10 border-white/20
                  text-white placeholder:text-white/40
                  hover:bg-white/15 hover:border-cyan-400/50
                  focus:bg-white/15 focus:border-cyan-400
                "
              />
            </Form.Item>

            {/* 联系方式 */}
            <Form.Item
              name="contact"
              label={<span className="text-white/80">联系方式</span>}
              rules={[{ required: true, message: '请输入联系方式' }]}
            >
              <Input
                placeholder="微信号或手机号"
                className="
                  h-12
                  bg-white/10 border-white/20
                  text-white placeholder:text-white/40
                  hover:bg-white/15 hover:border-cyan-400/50
                  focus:bg-white/15 focus:border-cyan-400
                "
              />
            </Form.Item>

            {/* 推广渠道说明 */}
            <Form.Item
              name="channel"
              label={<span className="text-white/80">推广渠道说明（可选）</span>}
            >
              <TextArea
                placeholder="请简要说明您的推广渠道，例如：朋友圈、微信群、个人博客等"
                rows={4}
                className="
                  bg-white/10 border-white/20
                  text-white placeholder:text-white/40
                  hover:bg-white/15 hover:border-cyan-400/50
                  focus:bg-white/15 focus:border-cyan-400
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
                  bg-gradient-to-r from-cyan-500 to-blue-500
                  border-0
                  text-white font-semibold text-base
                  hover:from-cyan-400 hover:to-blue-400
                  disabled:opacity-50
                "
              >
                {submitting ? '提交中...' : '提交申请'}
              </Button>
            </Form.Item>
          </Form>

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-xs text-white/60 leading-relaxed">
              温馨提示：提交申请后，我们将在1-3个工作日内完成审核。
              审核通过后，您将获得专属邀请码和推广链接。
              请确保填写的信息真实有效，以便后续佣金提现。
            </p>
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/workspace')}
            className="
              text-cyan-400 text-sm
              hover:text-cyan-300
              transition-colors duration-300
            "
          >
            ← 返回工作台
          </button>
        </div>
      </div>
    </div>
  );
}
