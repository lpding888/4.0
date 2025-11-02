/**
 * Step 1: 基本信息步骤
 * 艹！收集Feature的核心元数据！
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, InputNumber, Button, Space, Alert, Tag } from 'antd';
import { RightOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

interface BasicInfoStepProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
}

/**
 * 功能分类选项
 */
const CATEGORY_OPTIONS = [
  { label: '图片处理', value: '图片处理' },
  { label: '文本生成', value: '文本生成' },
  { label: '数据分析', value: '数据分析' },
  { label: '语音处理', value: '语音处理' },
  { label: '视频处理', value: '视频处理' },
  { label: '其他', value: '其他' },
];

/**
 * 图标选项（Ant Design Icons）
 */
const ICON_OPTIONS = [
  { label: '图片', value: 'picture' },
  { label: '文件', value: 'file-text' },
  { label: '视频', value: 'video-camera' },
  { label: '音频', value: 'audio' },
  { label: '代码', value: 'code' },
  { label: '工具', value: 'tool' },
  { label: '星星', value: 'star' },
  { label: '火箭', value: 'rocket' },
];

/**
 * 会员计划选项
 */
const PLAN_OPTIONS = [
  { label: 'Free - 免费用户可用', value: 'free' },
  { label: 'Basic - 基础会员可用', value: 'basic' },
  { label: 'Pro - 专业会员可用', value: 'pro' },
  { label: 'Enterprise - 企业会员可用', value: 'enterprise' },
];

/**
 * 访问控制选项
 */
const ACCESS_SCOPE_OPTIONS = [
  { label: 'Plan - 基于会员计划', value: 'plan' },
  { label: 'Feature - 需要单独购买', value: 'feature' },
  { label: 'Admin - 仅管理员', value: 'admin' },
];

export default function BasicInfoStep({
  data,
  onUpdate,
  onNext,
}: BasicInfoStepProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    form.setFieldsValue({
      feature_id: data.feature_id || '',
      display_name: data.display_name || '',
      description: data.description || '',
      category: data.category || '图片处理',
      icon: data.icon || 'picture',
      plan_required: data.plan_required || 'free',
      access_scope: data.access_scope || 'plan',
      quota_cost: data.quota_cost || 1,
      rate_limit_policy: data.rate_limit_policy || '',
    });
  }, [data, form]);

  /**
   * 下一步
   */
  const handleNext = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 更新数据
      onUpdate(values);

      // 进入下一步
      onNext();
    } catch (error: any) {
      console.error('[BasicInfoStep] 校验失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Feature ID变化时自动生成建议
   */
  const handleFeatureIdBlur = () => {
    const featureId = form.getFieldValue('feature_id');
    const displayName = form.getFieldValue('display_name');

    // 如果display_name为空，根据feature_id生成建议
    if (!displayName && featureId) {
      const suggested = featureId
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      form.setFieldValue('display_name', suggested);
    }
  };

  return (
    <Card
      title="Step 1: 基本信息"
      extra={<Tag color="blue">必填项</Tag>}
    >
      <Alert
        message="操作提示"
        description="填写Feature的核心元数据，这些信息将用于功能卡片展示和访问控制。"
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
        closable
      />

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        {/* Feature ID */}
        <Form.Item
          label="Feature ID"
          name="feature_id"
          rules={[
            { required: true, message: '请输入Feature ID' },
            {
              pattern: /^[a-z0-9-]+$/,
              message: '只能包含小写字母、数字和连字符',
            },
          ]}
          tooltip="唯一标识符，使用小写字母和连字符，如: image-upscale"
        >
          <Input
            placeholder="例如: image-upscale"
            onBlur={handleFeatureIdBlur}
          />
        </Form.Item>

        {/* Display Name */}
        <Form.Item
          label="显示名称"
          name="display_name"
          rules={[
            { required: true, message: '请输入显示名称' },
            { max: 50, message: '最多50个字符' },
          ]}
        >
          <Input placeholder="例如: 图片放大" />
        </Form.Item>

        {/* Description */}
        <Form.Item
          label="功能描述"
          name="description"
          rules={[
            { required: true, message: '请输入功能描述' },
            { max: 200, message: '最多200个字符' },
          ]}
        >
          <TextArea
            rows={3}
            placeholder="简要描述此功能的作用和使用场景..."
            showCount
            maxLength={200}
          />
        </Form.Item>

        {/* Category + Icon */}
        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            label="功能分类"
            name="category"
            rules={[{ required: true, message: '请选择功能分类' }]}
            style={{ flex: 1, minWidth: '200px' }}
          >
            <Select placeholder="选择分类">
              {CATEGORY_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="图标"
            name="icon"
            rules={[{ required: true, message: '请选择图标' }]}
            style={{ flex: 1, minWidth: '200px' }}
          >
            <Select placeholder="选择图标">
              {ICON_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Space>

        {/* Plan Required */}
        <Form.Item
          label="所需会员计划"
          name="plan_required"
          rules={[{ required: true, message: '请选择所需会员计划' }]}
          tooltip="用户需要达到此会员等级才能使用该功能"
        >
          <Select placeholder="选择会员计划">
            {PLAN_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Access Scope */}
        <Form.Item
          label="访问控制"
          name="access_scope"
          rules={[{ required: true, message: '请选择访问控制方式' }]}
          tooltip="Plan: 基于会员计划自动授权 | Feature: 需要单独购买 | Admin: 仅管理员"
        >
          <Select placeholder="选择访问控制">
            {ACCESS_SCOPE_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Quota Cost + Rate Limit */}
        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            label="配额消耗"
            name="quota_cost"
            rules={[
              { required: true, message: '请输入配额消耗' },
              { type: 'number', min: 0, message: '必须大于等于0' },
            ]}
            tooltip="每次调用消耗的配额点数"
            style={{ flex: 1, minWidth: '200px' }}
          >
            <InputNumber
              min={0}
              step={1}
              style={{ width: '100%' }}
              placeholder="例如: 1"
            />
          </Form.Item>

          <Form.Item
            label="速率限制策略"
            name="rate_limit_policy"
            tooltip="可选，格式: 10/minute 或 100/hour"
            style={{ flex: 1, minWidth: '200px' }}
          >
            <Input placeholder="例如: 10/minute" />
          </Form.Item>
        </Space>
      </Form>

      {/* 底部操作栏 */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          icon={<RightOutlined />}
          onClick={handleNext}
          loading={loading}
        >
          下一步：表单设计
        </Button>
      </div>
    </Card>
  );
}
