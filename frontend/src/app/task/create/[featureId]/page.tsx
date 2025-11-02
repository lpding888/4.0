'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, Spin, Button, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { FormSchema } from '@/types';
import DynamicForm from '@/components/DynamicForm';

/**
 * 动态表单页面 - 根据 featureId 渲染表单
 *
 * 艹，这个页面完全动态化，不能硬编码任何功能的表单！
 */
export default function CreateTaskByFeaturePage() {
  const router = useRouter();
  const params = useParams();
  const featureId = params.featureId as string;
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);

  // 获取表单Schema
  const fetchFormSchema = async () => {
    try {
      setLoading(true);
      const response: any = await api.features.getFormSchema(featureId);

      if (response.success) {
        setFormSchema(response);
      }
    } catch (error: any) {
      message.error('获取表单失败');
      console.error('获取表单Schema失败:', error);
      router.push('/workspace'); // 获取失败，返回工作台
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 检查登录状态
    if (!user) {
      router.push('/login');
      return;
    }

    fetchFormSchema();
  }, [user, featureId, router]);

  // 提交表单
  const handleSubmit = async (formData: Record<string, any>) => {
    try {
      const response: any = await api.task.createByFeature({
        featureId,
        inputData: formData
      });

      if (response.success && response.data) {
        message.success('任务创建成功');
        // 跳转到任务详情页
        router.push(`/task/${response.data.taskId}`);
      }
    } catch (error: any) {
      // 处理各种错误
      if (error.code === 4002) {
        message.error('配额不足，请先充值');
        setTimeout(() => router.push('/membership'), 1500);
      } else if (error.code === 4003) {
        message.error('权限不足，请升级会员');
        setTimeout(() => router.push('/membership'), 1500);
      } else if (error.code === 4029) {
        message.error('操作过于频繁，请稍后再试');
      } else {
        message.error(error.message || '创建任务失败');
      }
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!formSchema) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950">
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <p className="text-white text-center">表单加载失败</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 返回按钮 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          className="mb-6 border-white/20 text-white hover:bg-white/10"
        >
          返回
        </Button>

        {/* 表单卡片（艹，遵循青蓝玻璃拟态主题！）*/}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-2xl shadow-xl">
          <DynamicForm schema={formSchema} onSubmit={handleSubmit} />
        </Card>
      </div>
    </div>
  );
}
