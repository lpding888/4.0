'use client';

/**
 * Feature创建向导页面（CMS-208 + CMS-306）
 * 艹！使用Step Wizard引导管理员创建完整的Feature！
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Steps, Card, Button, Space, message } from 'antd';
import {
  InfoCircleOutlined,
  FormOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';

// Step组件
import BasicInfoStep from '@/components/admin/FeatureWizard/BasicInfoStep';
import FormDesignStep from '@/components/admin/FeatureWizard/FormDesignStep';
import PipelineEditorStep from '@/components/admin/FeatureWizard/PipelineEditorStep';
import PreviewPublishStep from '@/components/admin/FeatureWizard/PreviewPublishStep';

/**
 * Feature数据结构
 */
interface FeatureData {
  // Step 1: 基本信息
  feature_id: string;
  display_name: string;
  description: string;
  category: string;
  icon: string;
  plan_required: string;
  access_scope: string;
  quota_cost: number;
  rate_limit_policy?: string;

  // Step 2: 表单Schema
  form_schema_id?: string;
  form_schema_data?: any;

  // Step 3: Pipeline Schema
  pipeline_schema_id?: string;
  pipeline_schema_data?: any;
}

export default function FeatureWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [featureData, setFeatureData] = useState<FeatureData>({
    feature_id: '',
    display_name: '',
    description: '',
    category: '图片处理',
    icon: 'picture',
    plan_required: 'free',
    access_scope: 'plan',
    quota_cost: 1,
  });

  /**
   * 更新Feature数据
   */
  const updateFeatureData = (data: Partial<FeatureData>) => {
    setFeatureData((prev) => ({ ...prev, ...data }));
  };

  /**
   * 下一步
   */
  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  /**
   * 上一步
   */
  const handlePrev = () => {
    setCurrentStep((prev) => prev - 1);
  };

  /**
   * 完成创建
   */
  const handleFinish = async () => {
    try {
      // 调用Feature Wizard API创建Feature
      console.log('[Feature创建] 数据:', featureData);

      const response: any = await api.admin.createFeatureFromWizard(featureData);

      if (response.success) {
        message.success(`Feature "${featureData.display_name}" 创建成功！`);
        router.push('/admin/features');
      } else {
        throw new Error(response.error?.message || '创建失败');
      }
    } catch (error: any) {
      console.error('[Feature创建] 失败:', error);
      message.error(`创建失败: ${error.message || '未知错误'}`);
    }
  };

  // 步骤配置
  const steps = [
    {
      title: '基本信息',
      icon: <InfoCircleOutlined />,
      content: (
        <BasicInfoStep
          data={featureData}
          onUpdate={updateFeatureData}
          onNext={handleNext}
        />
      ),
    },
    {
      title: '表单设计',
      icon: <FormOutlined />,
      content: (
        <FormDesignStep
          data={featureData}
          onUpdate={updateFeatureData}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      ),
    },
    {
      title: '流程编排',
      icon: <BranchesOutlined />,
      content: (
        <PipelineEditorStep
          data={featureData}
          onUpdate={updateFeatureData}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      ),
    },
    {
      title: '预览发布',
      icon: <CheckCircleOutlined />,
      content: (
        <PreviewPublishStep
          data={featureData}
          onFinish={handleFinish}
          onPrev={handlePrev}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部导航 */}
      <div style={{ marginBottom: '24px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          返回
        </Button>
      </div>

      {/* 标题 */}
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        创建新功能 (Feature)
      </h1>

      {/* 步骤导航 */}
      <Card style={{ marginBottom: '24px' }}>
        <Steps
          current={currentStep}
          items={steps.map((step) => ({
            title: step.title,
            icon: step.icon,
          }))}
        />
      </Card>

      {/* 步骤内容 */}
      <div>{steps[currentStep].content}</div>
    </div>
  );
}
