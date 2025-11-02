'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Tabs,
  Form,
  Input,
  Select,
  Switch,
  Button,
  message,
  Radio
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import JSONEditor from '@/components/JSONEditor';

const { TextArea } = Input;
const { Option } = Select;

/**
 * 功能卡片编辑页
 *
 * 艹，这个页面支持新增和编辑，包含3个Tab！
 */
export default function AdminFeatureEditPage() {
  const router = useRouter();
  const params = useParams();
  const featureId = params?.featureId as string;
  const isNew = featureId === 'new';

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [formSchema, setFormSchema] = useState('{}');
  const [pipelineSchema, setPipelineSchema] = useState('{}');
  const [accessScope, setAccessScope] = useState<'plan' | 'whitelist'>('plan');

  // 获取功能详情（编辑模式）
  const fetchFeatureDetail = async () => {
    if (isNew) return;

    try {
      setLoading(true);
      // 从列表接口获取所有功能，找到当前编辑的
      const response: any = await api.admin.getFeatures();

      if (response.success && response.features) {
        const feature = response.features.find((f: any) => f.feature_id === featureId);

        if (feature) {
          // 填充表单
          form.setFieldsValue({
            feature_id: feature.feature_id,
            display_name: feature.display_name,
            category: feature.category,
            description: feature.description,
            is_enabled: feature.is_enabled,
            plan_required: feature.plan_required,
            access_scope: feature.access_scope,
            allowed_accounts: feature.allowed_accounts?.join('\n') || '',
            quota_cost: feature.quota_cost,
            rate_limit_policy: feature.rate_limit_policy || '',
            output_type: feature.output_type,
            save_to_asset_library: feature.save_to_asset_library
          });

          setAccessScope(feature.access_scope);

          // 填充 JSON Schema（需要从详情接口获取）
          // TODO: 调用详情接口获取完整schema
          setFormSchema(JSON.stringify(feature.form_schema || {}, null, 2));
          setPipelineSchema(JSON.stringify(feature.pipeline_schema || {}, null, 2));
        }
      }
    } catch (error: any) {
      message.error('获取功能详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureDetail();
  }, [featureId]);

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 处理 allowed_accounts：多行文本 → 数组
      const accountsText = values.allowed_accounts || '';
      const accountsArray = accountsText
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      // 验证 JSON Schema
      let parsedFormSchema, parsedPipelineSchema;
      try {
        parsedFormSchema = JSON.parse(formSchema);
        parsedPipelineSchema = JSON.parse(pipelineSchema);
      } catch (error: any) {
        message.error('JSON Schema 格式错误');
        return;
      }

      const payload = {
        ...values,
        allowed_accounts: accountsArray,
        form_schema: parsedFormSchema,
        pipeline_schema: parsedPipelineSchema
      };

      setLoading(true);

      if (isNew) {
        await api.admin.createFeature(payload);
        message.success('功能创建成功');
      } else {
        await api.admin.updateFeature(featureId, payload);
        message.success('功能更新成功');
      }

      router.push('/admin/features');
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请检查表单填写');
      } else {
        message.error(error.message || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 示例模板
  const loadTemplate = (templateName: string) => {
    const templates: Record<string, any> = {
      basic_clean: {
        form_schema: {
          fields: [
            {
              name: 'image',
              label: '上传图片',
              type: 'imageUpload',
              required: true,
              validation: {
                maxSize: 10485760,
                allowedTypes: ['image/jpeg', 'image/png']
              }
            }
          ]
        },
        pipeline_schema: {
          steps: [
            {
              provider: 'tencent_ci',
              action: 'background_removal',
              params: {}
            }
          ]
        }
      },
      model_pose12: {
        form_schema: {
          fields: [
            {
              name: 'image',
              label: '服装图片',
              type: 'imageUpload',
              required: true
            },
            {
              name: 'style',
              label: '场景风格',
              type: 'enum',
              required: true,
              options: [
                { value: 'street', label: '街头风' },
                { value: 'studio', label: '影棚风' }
              ]
            }
          ]
        },
        pipeline_schema: {
          steps: [
            {
              provider: 'runninghub',
              action: 'model_generation',
              params: {
                poses: 12
              }
            }
          ]
        }
      },
      video: {
        form_schema: {
          fields: [
            {
              name: 'images',
              label: '服装图片',
              type: 'multiImageUpload',
              required: true
            },
            {
              name: 'duration',
              label: '视频时长（秒）',
              type: 'number',
              required: true,
              validation: { min: 5, max: 30 }
            }
          ]
        },
        pipeline_schema: {
          steps: [
            {
              provider: 'kuai',
              action: 'video_generation',
              params: {}
            }
          ]
        }
      }
    };

    const template = templates[templateName];
    if (template) {
      setFormSchema(JSON.stringify(template.form_schema, null, 2));
      setPipelineSchema(JSON.stringify(template.pipeline_schema, null, 2));
      message.success(`已加载"${templateName}"模板`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.back()}
              className="border-white/20 text-white hover:bg-white/10"
            >
              返回
            </Button>
            <h1 className="text-3xl font-light text-white">
              {isNew ? '新增功能卡片' : '编辑功能卡片'}
            </h1>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={handleSubmit}
            className="border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-400/30"
          >
            保存
          </Button>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-6">
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: '1',
                label: '功能定义',
                children: (
                  <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                      is_enabled: true,
                      plan_required: 'basic',
                      access_scope: 'plan',
                      quota_cost: 1,
                      output_type: 'multiImage',
                      save_to_asset_library: true
                    }}
                  >
                    <Form.Item
                      label={<span className="text-white">Feature ID</span>}
                      name="feature_id"
                      rules={[{ required: true, message: '请输入 Feature ID' }]}
                    >
                      <Input
                        disabled={!isNew}
                        placeholder="例如：basic_clean"
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">显示名称</span>}
                      name="display_name"
                      rules={[{ required: true }]}
                    >
                      <Input
                        placeholder="例如：基础修图"
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">分类</span>}
                      name="category"
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="选择分类">
                        <Option value="基础处理">基础处理</Option>
                        <Option value="AI模特">AI模特</Option>
                        <Option value="视频生成">视频生成</Option>
                        <Option value="其他">其他</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">功能描述</span>}
                      name="description"
                      rules={[{ required: true }]}
                    >
                      <TextArea
                        rows={3}
                        placeholder="简短描述功能特点"
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">是否启用</span>}
                      name="is_enabled"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">所需套餐</span>}
                      name="plan_required"
                      rules={[{ required: true }]}
                    >
                      <Select>
                        <Option value="free">免费</Option>
                        <Option value="basic">基础会员</Option>
                        <Option value="pro">PRO会员</Option>
                        <Option value="enterprise">企业会员</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">访问范围</span>}
                      name="access_scope"
                      rules={[{ required: true }]}
                    >
                      <Radio.Group onChange={(e) => setAccessScope(e.target.value)}>
                        <Radio value="plan">套餐控制</Radio>
                        <Radio value="whitelist">白名单控制</Radio>
                      </Radio.Group>
                    </Form.Item>

                    {accessScope === 'whitelist' && (
                      <Form.Item
                        label={<span className="text-white">白名单账号（每行一个账号ID）</span>}
                        name="allowed_accounts"
                      >
                        <TextArea
                          rows={5}
                          placeholder="user_123&#10;user_456&#10;user_789"
                          className="bg-white/10 border-white/20 text-white font-mono"
                        />
                      </Form.Item>
                    )}

                    <Form.Item
                      label={<span className="text-white">配额消耗</span>}
                      name="quota_cost"
                      rules={[{ required: true }]}
                    >
                      <Input
                        type="number"
                        min={0}
                        placeholder="消耗配额数"
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">限流策略</span>}
                      name="rate_limit_policy"
                    >
                      <Input
                        placeholder='格式："hourly:3" 或 "daily:10"'
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">输出类型</span>}
                      name="output_type"
                      rules={[{ required: true }]}
                    >
                      <Select>
                        <Option value="singleImage">单图</Option>
                        <Option value="multiImage">多图</Option>
                        <Option value="video">视频</Option>
                        <Option value="zip">压缩包</Option>
                        <Option value="textBundle">文本</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label={<span className="text-white">自动保存到素材库</span>}
                      name="save_to_asset_library"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Form>
                )
              },
              {
                key: '2',
                label: '表单Schema',
                children: (
                  <div>
                    <div className="mb-4 flex gap-2">
                      <Button size="small" onClick={() => loadTemplate('basic_clean')}>
                        主图清洁增强
                      </Button>
                      <Button size="small" onClick={() => loadTemplate('model_pose12')}>
                        AI模特12分镜
                      </Button>
                      <Button size="small" onClick={() => loadTemplate('video')}>
                        上新合辑短片
                      </Button>
                    </div>
                    <JSONEditor
                      value={formSchema}
                      onChange={setFormSchema}
                      height={500}
                    />
                  </div>
                )
              },
              {
                key: '3',
                label: '执行Pipeline',
                children: (
                  <div>
                    <p className="text-white/60 mb-4">定义任务执行流程</p>
                    <JSONEditor
                      value={pipelineSchema}
                      onChange={setPipelineSchema}
                      height={500}
                    />
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
