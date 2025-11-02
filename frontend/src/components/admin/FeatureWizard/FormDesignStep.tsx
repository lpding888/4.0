/**
 * Step 2: 表单设计步骤
 * 艹！关联现有Form Schema或创建新的！
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Space, Radio, Select, Input, Alert, message, Spin, Tag } from 'antd';
import { LeftOutlined, RightOutlined, FormOutlined, PlusOutlined } from '@ant-design/icons';
import { formSchemas } from '@/lib/services/formSchemas';

const { Option } = Select;

interface FormDesignStepProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function FormDesignStep({
  data,
  onUpdate,
  onNext,
  onPrev,
}: FormDesignStepProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [schemas, setSchemas] = useState<any[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>(
    data.form_schema_id || ''
  );
  const [newSchemaId, setNewSchemaId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  /**
   * 加载Form Schema列表
   */
  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    try {
      setLoading(true);
      const response = await formSchemas.list({ limit: 100 });
      setSchemas(response.schemas);
    } catch (error: any) {
      console.error('[FormDesignStep] 加载Schema失败:', error);
      message.error('加载Form Schema列表失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 下一步
   */
  const handleNext = () => {
    if (mode === 'existing') {
      if (!selectedSchemaId) {
        message.warning('请选择一个Form Schema');
        return;
      }

      // 更新数据
      onUpdate({
        form_schema_id: selectedSchemaId,
      });
    } else {
      // 创建新Schema模式
      if (!newSchemaId) {
        message.warning('请输入新Schema ID');
        return;
      }

      // 检查ID格式
      if (!/^[a-z0-9-]+$/.test(newSchemaId)) {
        message.error('Schema ID只能包含小写字母、数字和连字符');
        return;
      }

      // 更新数据（标记为新建）
      onUpdate({
        form_schema_id: newSchemaId,
        _newSchema: true, // 标记为需要新建
      });
    }

    onNext();
  };

  /**
   * 跳转到Form Builder创建新Schema
   */
  const handleGoToBuilder = () => {
    window.open('/admin/forms/builder', '_blank');
  };

  /**
   * 预览选中的Schema
   */
  const handlePreviewSchema = async () => {
    if (!selectedSchemaId) {
      message.warning('请先选择一个Schema');
      return;
    }

    try {
      const schema = await formSchemas.get(selectedSchemaId);
      console.log('[FormDesignStep] Schema详情:', schema);

      // TODO: 展示预览弹窗
      message.info('Schema预览功能即将上线');
    } catch (error: any) {
      message.error(`加载Schema失败: ${error.message}`);
    }
  };

  /**
   * 获取Schema的显示信息
   */
  const getSchemaInfo = (schemaId: string) => {
    const schema = schemas.find((s) => s.schema_id === schemaId);
    if (!schema) return null;

    return {
      version: schema.version,
      status: schema.publish_status,
      description: schema.version_description || '无描述',
      updatedAt: new Date(schema.updated_at).toLocaleString('zh-CN'),
    };
  };

  return (
    <Card
      title="Step 2: 表单设计"
      extra={<Tag color="cyan">关联Schema</Tag>}
    >
      <Alert
        message="操作提示"
        description="选择一个现有的Form Schema，或者创建新的。Form Schema定义了用户提交时的表单结构。"
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
        closable
      />

      {/* 模式选择 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontWeight: 500, marginBottom: '12px' }}>表单来源:</div>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          buttonStyle="solid"
        >
          <Radio.Button value="existing">
            <FormOutlined /> 使用现有Schema
          </Radio.Button>
          <Radio.Button value="new">
            <PlusOutlined /> 创建新Schema
          </Radio.Button>
        </Radio.Group>
      </div>

      {/* 现有Schema选择 */}
      {mode === 'existing' && (
        <Spin spinning={loading}>
          <div>
            <div style={{ fontWeight: 500, marginBottom: '12px' }}>
              选择Form Schema:
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择一个Schema"
              value={selectedSchemaId || undefined}
              onChange={setSelectedSchemaId}
              showSearch
              optionFilterProp="children"
            >
              {schemas.map((schema) => (
                <Option key={schema.schema_id} value={schema.schema_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{schema.schema_id}</span>
                    <Space size="small">
                      <Tag color="blue">v{schema.version}</Tag>
                      <Tag
                        color={
                          schema.publish_status === 'published'
                            ? 'green'
                            : schema.publish_status === 'draft'
                            ? 'orange'
                            : 'default'
                        }
                      >
                        {schema.publish_status}
                      </Tag>
                    </Space>
                  </div>
                </Option>
              ))}
            </Select>

            {/* Schema详情展示 */}
            {selectedSchemaId && getSchemaInfo(selectedSchemaId) && (
              <Card
                size="small"
                style={{ marginTop: '16px', background: '#fafafa' }}
              >
                <div style={{ fontSize: '13px', color: '#666' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>版本:</strong> v{getSchemaInfo(selectedSchemaId)?.version}
                    {' | '}
                    <strong>状态:</strong>{' '}
                    <Tag
                      color={
                        getSchemaInfo(selectedSchemaId)?.status === 'published'
                          ? 'green'
                          : 'orange'
                      }
                      style={{ marginLeft: 0 }}
                    >
                      {getSchemaInfo(selectedSchemaId)?.status}
                    </Tag>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>描述:</strong> {getSchemaInfo(selectedSchemaId)?.description}
                  </div>
                  <div>
                    <strong>更新时间:</strong> {getSchemaInfo(selectedSchemaId)?.updatedAt}
                  </div>
                </div>
              </Card>
            )}

            {/* 操作按钮 */}
            <div style={{ marginTop: '16px' }}>
              <Button onClick={handlePreviewSchema} disabled={!selectedSchemaId}>
                预览Schema
              </Button>
            </div>
          </div>
        </Spin>
      )}

      {/* 新建Schema */}
      {mode === 'new' && (
        <div>
          <div style={{ fontWeight: 500, marginBottom: '12px' }}>
            新Schema ID:
          </div>
          <Input
            placeholder="例如: user-profile-form"
            value={newSchemaId}
            onChange={(e) => setNewSchemaId(e.target.value)}
            style={{ marginBottom: '16px' }}
          />

          <Alert
            message="提示"
            description={
              <div>
                <p style={{ margin: 0 }}>输入新Schema ID后，您可以：</p>
                <ol style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                  <li>完成Feature向导后，再使用Form Builder设计表单</li>
                  <li>或者先去Form Builder创建Schema，然后返回此处选择</li>
                </ol>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleGoToBuilder}
            block
          >
            前往Form Builder创建Schema
          </Button>
        </div>
      )}

      {/* 底部操作栏 */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <Button icon={<LeftOutlined />} onClick={onPrev}>
          上一步
        </Button>
        <Button type="primary" icon={<RightOutlined />} onClick={handleNext}>
          下一步：流程编排
        </Button>
      </div>
    </Card>
  );
}
