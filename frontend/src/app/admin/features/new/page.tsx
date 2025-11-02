'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Button,
  Card,
  Space,
  message,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { TextArea } = Input;
const { Title, Text } = Typography;

const planOptions = [
  { label: '免费', value: 'free' },
  { label: '基础版', value: 'basic' },
  { label: '专业版', value: 'pro' },
  { label: '企业版', value: 'enterprise' },
];

const accessOptions = [
  { label: '按套餐', value: 'plan' },
  { label: '白名单', value: 'whitelist' },
];

const outputTypeOptions = [
  { label: '单张图片', value: 'singleImage' },
  { label: '多张图片', value: 'multiImage' },
  { label: '视频', value: 'video' },
  { label: '压缩包', value: 'zip' },
  { label: '文本合集', value: 'textBundle' },
];

const defaultFormSchema = (featureId: string) =>
  JSON.stringify(
    {
      schema_id: `${featureId || 'example'}_form`,
      fields: [
        {
          name: 'inputImage',
          label: '上传图片',
          type: 'imageUpload',
          required: true,
          helpText: '支持 JPG/PNG，最大 10MB',
          validation: {
            maxSize: 10,
            allowedTypes: ['image/jpeg', 'image/png'],
          },
        },
      ],
    },
    null,
    2,
  );

const defaultPipelineSchema = (featureId: string) =>
  JSON.stringify(
    {
      pipeline_id: `${featureId || 'example'}_pipeline`,
      steps: [
        {
          name: 'process',
          provider: 'internal',
          action: 'basic_clean',
          config: {},
        },
      ],
    },
    null,
    2,
  );

interface FeatureFormValues {
  feature_id: string;
  display_name: string;
  description?: string;
  category?: string;
  plan_required: string;
  access_scope: 'plan' | 'whitelist';
  quota_cost: number;
  rate_limit_policy?: string;
  allowed_accounts?: string;
  output_type: string;
  save_to_asset_library: boolean;
  is_enabled: boolean;
  form_schema: string;
  pipeline_schema: string;
  thumbnail?: string;
  tags?: string;
}

export default function CreateFeaturePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm<FeatureFormValues>();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'admin') {
      message.error('无权限访问');
      router.replace('/workspace');
    }
  }, [user, router]);

  const featureId = Form.useWatch('feature_id', form);

  const initialValues = useMemo<Partial<FeatureFormValues>>(
    () => ({
      plan_required: 'free',
      access_scope: 'plan',
      quota_cost: 1,
      output_type: 'singleImage',
      save_to_asset_library: true,
      is_enabled: true,
      category: '通用能力',
      form_schema: defaultFormSchema('example'),
      pipeline_schema: defaultPipelineSchema('example'),
    }),
    [],
  );

  useEffect(() => {
    if (!featureId) return;
    const currentFormSchema = form.getFieldValue('form_schema');
    const currentPipelineSchema = form.getFieldValue('pipeline_schema');

    if (!currentFormSchema || currentFormSchema.includes('"example"_form')) {
      form.setFieldsValue({ form_schema: defaultFormSchema(featureId) });
    }
    if (!currentPipelineSchema || currentPipelineSchema.includes('"example"_pipeline')) {
      form.setFieldsValue({ pipeline_schema: defaultPipelineSchema(featureId) });
    }
  }, [featureId, form]);

  const handleSubmit = async (values: FeatureFormValues) => {
    try {
      const { form_schema, pipeline_schema, allowed_accounts, tags, ...rest } = values;

      const parsedFormSchema = JSON.parse(form_schema || '{}');
      const parsedPipelineSchema = JSON.parse(pipeline_schema || '{}');

      if (!parsedFormSchema.schema_id || !Array.isArray(parsedFormSchema.fields)) {
        throw new Error('表单Schema格式不正确，必须包含 schema_id 与 fields 数组');
      }

      if (!parsedPipelineSchema.pipeline_id || !Array.isArray(parsedPipelineSchema.steps)) {
        throw new Error('Pipeline Schema格式不正确，必须包含 pipeline_id 与 steps 数组');
      }

      const payload = {
        feature_definition: {
          ...rest,
          allowed_accounts: allowed_accounts || null,
          tags: tags ? tags.split(',').map((item) => item.trim()).filter(Boolean) : null,
        },
        form_schema: parsedFormSchema,
        pipeline_schema: parsedPipelineSchema,
      };

      const response: any = await api.admin.createFeature(payload);

      if (response.success) {
        message.success('功能卡片创建成功');
        router.push('/admin/features');
      } else {
        throw new Error(response?.error?.message || '创建失败');
      }
    } catch (error: any) {
      console.error('创建功能失败:', error);
      message.error(error.message || '创建失败，请检查表单内容');
    }
  };

  const handleCancel = () => {
    router.push('/admin/features');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Space align="center" className="text-white">
          <Button
            icon={<ArrowLeftOutlined />}
            type="link"
            className="text-cyan-300"
            onClick={handleCancel}
          >
            返回列表
          </Button>
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            新增功能卡片
          </Title>
        </Space>

        <Card
          className="bg-white/10 backdrop-blur-md border border-white/20 text-white"
          title={<span className="text-white">基础信息</span>}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Form.Item
              label="Feature ID"
              name="feature_id"
              rules={[
                { required: true, message: '请输入 Feature ID' },
                { pattern: /^[a-z0-9_]+$/, message: '只允许小写字母、数字和下划线' },
              ]}
            >
              <Input placeholder="例如：basic_clean_plus" />
            </Form.Item>

            <Form.Item
              label="展示名称"
              name="display_name"
              rules={[{ required: true, message: '请输入展示名称' }]}
            >
              <Input placeholder="功能卡片标题（用户可见）" />
            </Form.Item>

            <Form.Item label="分类" name="category" rules={[{ required: true, message: '请输入分类' }]}>
              <Input placeholder="例如：图片增强 / 视频生成 / 营销内容" />
            </Form.Item>

            <Form.Item label="功能描述" name="description">
              <TextArea rows={3} placeholder="用于工作台展示的功能介绍" />
            </Form.Item>

            <Form.Item
              label="所需会员等级"
              name="plan_required"
              rules={[{ required: true, message: '请选择会员等级' }]}
            >
              <Select options={planOptions} />
            </Form.Item>

            <Form.Item label="访问控制范围" name="access_scope" rules={[{ required: true }]}>
              <Select options={accessOptions} />
            </Form.Item>

            <Form.Item label="允许账号（白名单）" name="allowed_accounts" extra="一行一个账号，只有 access_scope=whitelist 时生效">
              <TextArea rows={3} placeholder="例如：13800138000" />
            </Form.Item>

            <Form.Item
              label="配额消耗（次）"
              name="quota_cost"
              rules={[{ required: true, message: '请输入配额消耗' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="限流策略" name="rate_limit_policy" extra="可留空，示例：5/min">
              <Input placeholder="例如：30/min" />
            </Form.Item>

            <Form.Item
              label="输出类型"
              name="output_type"
              rules={[{ required: true, message: '请选择输出类型' }]}
            >
              <Select options={outputTypeOptions} />
            </Form.Item>

            <Form.Item label="保存素材到素材库" name="save_to_asset_library" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item label="启用功能" name="is_enabled" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item label="缩略图地址" name="thumbnail">
              <Input placeholder="可选，用于展示的缩略图 URL" />
            </Form.Item>

            <Form.Item label="标签" name="tags" extra="使用英文逗号分隔，例如：主图,白底">
              <Input />
            </Form.Item>

            <Card
              title="表单 Schema（JSON）"
              className="bg-white/5 border border-white/10 text-white"
              style={{ marginBottom: 24 }}
            >
              <Form.Item
                name="form_schema"
                rules={[{ required: true, message: '请输入表单 Schema JSON' }]}
              >
                <TextArea rows={12} spellCheck={false} />
              </Form.Item>
              <Text type="secondary">
                schema_id 建议使用 {featureId ? `${featureId}_form` : 'feature_form'}，fields 需包含字段配置。
              </Text>
            </Card>

            <Card
              title="Pipeline Schema（JSON）"
              className="bg-white/5 border border-white/10 text-white"
              style={{ marginBottom: 24 }}
            >
              <Form.Item
                name="pipeline_schema"
                rules={[{ required: true, message: '请输入 Pipeline Schema JSON' }]}
              >
                <TextArea rows={10} spellCheck={false} />
              </Form.Item>
              <Text type="secondary">
                pipeline_id 建议使用 {featureId ? `${featureId}_pipeline` : 'feature_pipeline'}，steps 定义执行步骤。
              </Text>
            </Card>

            <Form.Item>
              <Space>
                <Button onClick={handleCancel}>取消</Button>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} className="bg-cyan-500">
                  创建功能
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}

