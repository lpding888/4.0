'use client';

/**
 * 表单设计器页面（新版本 - 对接CMS-105 API）
 * 艹！使用GPT5工业级框架重构，集成版本管理！
 */

import { useState, useMemo, useEffect } from 'react';
import { Card, Button, Space, message, Tabs, Tag, Alert, Input, Modal, Select } from 'antd';
import { FormOutlined, EyeOutlined, CodeOutlined, SaveOutlined, SwapOutlined, HistoryOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { convertFormioToUFS } from '@/lib/formio/adapter';
import { validateUFSSchema } from '@/lib/validators';
import { formSchemas, FormSchemaVersion } from '@/lib/services/formSchemas';

// 艹，使用next/dynamic关闭SSR，这个tm很关键！
const FormBuilder = dynamic(() => import('@/components/formio/FormBuilder'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '48px', textAlign: 'center' }}>
      加载Form Builder中...
    </div>
  ),
});

const UfsRenderer = dynamic(() => import('@/components/ufs/UfsRenderer'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '48px', textAlign: 'center' }}>
      加载UFS渲染器中...
    </div>
  ),
});

export default function FormBuilderPage() {
  const [formSchema, setFormSchema] = useState<any>({
    components: [],
  });
  const [activeTab, setActiveTab] = useState('builder');
  const [submission, setSubmission] = useState<any>(null);

  // CMS-106: 新增状态
  const [schemaId, setSchemaId] = useState<string>('');
  const [versionDescription, setVersionDescription] = useState<string>('');
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [versions, setVersions] = useState<FormSchemaVersion[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 转换Formio Schema为UFS
   * 艹，实时转换并缓存结果！
   */
  const ufsSchema = useMemo(() => {
    try {
      if (!formSchema || !formSchema.components || formSchema.components.length === 0) {
        return null;
      }
      return convertFormioToUFS(formSchema);
    } catch (error: any) {
      console.error('[UFS转换失败]', error);
      return null;
    }
  }, [formSchema]);

  /**
   * 校验UFS Schema
   */
  const ufsValidation = useMemo(() => {
    if (!ufsSchema) return null;
    return validateUFSSchema(ufsSchema);
  }, [ufsSchema]);

  /**
   * FormBuilder变化回调
   * 艹，每次拖拽字段都会触发这个回调！
   */
  const handleSchemaChange = (schema: any) => {
    console.log('[FormBuilder] Schema变化:', schema);
    setFormSchema(schema);
  };

  /**
   * UFS表单提交回调
   * 艹，这个tm处理UFS渲染器的提交！
   */
  const handleUfsSubmit = (data: any) => {
    console.log('[UFS渲染器] 表单提交:', data);
    message.success('UFS表单提交成功！');
    setSubmission(data);
  };

  /**
   * CMS-106: 加载Schema版本历史
   */
  const loadVersions = async () => {
    if (!schemaId) return;

    try {
      const data = await formSchemas.getVersions(schemaId);
      setVersions(data.versions);
    } catch (error: any) {
      console.error('[加载版本历史失败]', error);
    }
  };

  /**
   * CMS-106: 打开保存弹窗
   */
  const handleOpenSaveModal = () => {
    if (!formSchema || formSchema.components.length === 0) {
      message.warning('表单为空，无需保存');
      return;
    }
    setSaveModalVisible(true);
  };

  /**
   * CMS-106: 保存表单Schema到后端
   */
  const handleSave = async () => {
    if (!schemaId) {
      message.error('请输入Schema ID');
      return;
    }

    try {
      setLoading(true);

      // 检查schema_id是否已存在
      let isNewSchema = false;
      try {
        await formSchemas.get(schemaId);
        // 已存在，创建新版本
        isNewSchema = false;
      } catch (error) {
        // 不存在，创建新Schema
        isNewSchema = true;
      }

      if (isNewSchema) {
        await formSchemas.create({
          schema_id: schemaId,
          fields: formSchema,
          version_description: versionDescription || '初始版本',
        });
        message.success('Schema创建成功');
        setCurrentVersion(1);
      } else {
        const newSchema = await formSchemas.createVersion(schemaId, {
          fields: formSchema,
          version_description: versionDescription || '新版本',
        });
        message.success(`新版本 v${newSchema.version} 创建成功`);
        setCurrentVersion(newSchema.version);
      }

      setSaveModalVisible(false);
      setVersionDescription('');
      await loadVersions();
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * CMS-106: 加载指定版本的Schema
   */
  const handleLoadVersion = async (version: number) => {
    if (!schemaId) return;

    try {
      setLoading(true);
      const data = await formSchemas.get(schemaId, version);
      setFormSchema(data.fields);
      setCurrentVersion(version);
      message.success(`已加载版本 v${version}`);
      setVersionModalVisible(false);
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 导出JSON
   */
  const handleExportJSON = () => {
    const json = JSON.stringify(formSchema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-schema-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('JSON已导出');
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <FormOutlined style={{ fontSize: '20px' }} />
            <span style={{ fontSize: '18px', fontWeight: 600 }}>表单设计器</span>
            <Tag color="blue">Form.io集成</Tag>
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder="Schema ID (如: user-profile)"
              value={schemaId}
              onChange={(e) => setSchemaId(e.target.value)}
              style={{ width: 200 }}
            />
            {currentVersion > 0 && (
              <Tag color="blue">v{currentVersion}</Tag>
            )}
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                if (!schemaId) {
                  message.warning('请先输入Schema ID');
                  return;
                }
                loadVersions();
                setVersionModalVisible(true);
              }}
            >
              版本历史
            </Button>
            <Button icon={<SaveOutlined />} type="primary" onClick={handleOpenSaveModal}>
              保存Schema
            </Button>
            <Button icon={<CodeOutlined />} onClick={handleExportJSON}>
              导出JSON
            </Button>
          </Space>
        }
      >
        {/* Tab切换 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'builder',
              label: (
                <span>
                  <FormOutlined /> 表单设计器
                </span>
              ),
              children: (
                <div>
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#f0f2f5',
                      borderRadius: '4px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                      💡 提示：从左侧拖拽字段到右侧画布，点击字段可配置属性
                    </p>
                  </div>
                  <FormBuilder schema={formSchema} onChange={handleSchemaChange} />
                </div>
              ),
            },
            {
              key: 'preview',
              label: (
                <span>
                  <EyeOutlined /> UFS实时预览
                  {ufsSchema && <Tag color="cyan" style={{ marginLeft: '8px' }}>RHF + AntD</Tag>}
                </span>
              ),
              children: (
                <div>
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#e6f7ff',
                      borderRadius: '4px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#0050b3' }}>
                      📝 UFS预览模式：使用react-hook-form + AntD渲染转换后的UFS Schema
                    </p>
                  </div>

                  {/* UFS校验状态提示 */}
                  {ufsValidation && !ufsValidation.success && (
                    <Alert
                      type="warning"
                      message="UFS Schema存在错误，无法渲染"
                      description={
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                          {ufsValidation.errors?.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      }
                      style={{ marginBottom: '16px' }}
                      showIcon
                    />
                  )}

                  {/* UFS渲染器 */}
                  {ufsSchema && ufsValidation?.success ? (
                    <div style={{
                      padding: '24px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      border: '1px solid #d9d9d9'
                    }}>
                      <UfsRenderer
                        schema={ufsSchema}
                        onSubmit={handleUfsSubmit}
                        onChange={(changed) => {
                          console.log('[UFS预览] 数据变化:', changed);
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '48px',
                        textAlign: 'center',
                        color: '#999',
                      }}
                    >
                      <FormOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                      <p>表单为空或转换失败，请先在设计器中添加字段</p>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'json',
              label: (
                <span>
                  <CodeOutlined /> Formio JSON
                </span>
              ),
              children: (
                <div>
                  <pre
                    style={{
                      padding: '16px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '600px',
                      fontSize: '12px',
                      lineHeight: '1.6',
                    }}
                  >
                    {JSON.stringify(formSchema, null, 2)}
                  </pre>
                </div>
              ),
            },
            {
              key: 'ufs',
              label: (
                <span>
                  <SwapOutlined /> UFS Schema
                  {ufsSchema && <Tag color="green" style={{ marginLeft: '8px' }}>已转换</Tag>}
                </span>
              ),
              children: (
                <div>
                  {/* UFS校验状态 */}
                  {ufsValidation && (
                    <Alert
                      type={ufsValidation.success ? 'success' : 'error'}
                      message={
                        ufsValidation.success
                          ? `✓ UFS Schema校验通过，包含 ${ufsSchema?.fields.length || 0} 个字段`
                          : '✗ UFS Schema校验失败'
                      }
                      description={
                        !ufsValidation.success && (
                          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                            {ufsValidation.errors?.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        )
                      }
                      style={{ marginBottom: '16px' }}
                    />
                  )}

                  {/* UFS Schema JSON */}
                  {ufsSchema ? (
                    <pre
                      style={{
                        padding: '16px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                        overflow: 'auto',
                        maxHeight: '600px',
                        fontSize: '12px',
                        lineHeight: '1.6',
                      }}
                    >
                      {JSON.stringify(ufsSchema, null, 2)}
                    </pre>
                  ) : (
                    <div
                      style={{
                        padding: '48px',
                        textAlign: 'center',
                        color: '#999',
                      }}
                    >
                      <SwapOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                      <p>表单为空或转换失败，请先在设计器中添加字段</p>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />

        {/* 提交数据展示 */}
        {submission && (
          <Card
            title="最近提交的数据"
            style={{ marginTop: '24px' }}
            size="small"
          >
            <pre
              style={{
                padding: '12px',
                background: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '12px',
                margin: 0,
              }}
            >
              {JSON.stringify(submission, null, 2)}
            </pre>
          </Card>
        )}
      </Card>

      {/* CMS-106: 保存Schema弹窗 */}
      <Modal
        title="保存表单Schema"
        open={saveModalVisible}
        onOk={handleSave}
        onCancel={() => setSaveModalVisible(false)}
        confirmLoading={loading}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Schema ID:</div>
            <Input
              value={schemaId}
              onChange={(e) => setSchemaId(e.target.value)}
              placeholder="例如: user-profile"
              disabled
            />
          </div>
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>版本描述:</div>
            <Input.TextArea
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder="描述本次修改的内容..."
              rows={3}
            />
          </div>
        </Space>
      </Modal>

      {/* CMS-106: 版本历史弹窗 */}
      <Modal
        title={`版本历史 - ${schemaId}`}
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={null}
        width={600}
      >
        {versions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            暂无版本历史
          </div>
        ) : (
          <div>
            {versions.map((ver) => (
              <Card
                key={ver.version}
                size="small"
                style={{ marginBottom: '12px' }}
                extra={
                  <Space>
                    {ver.is_current && <Tag color="green">当前</Tag>}
                    <Tag color={
                      ver.publish_status === 'published' ? 'blue' :
                      ver.publish_status === 'draft' ? 'orange' : 'default'
                    }>
                      {ver.publish_status}
                    </Tag>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => handleLoadVersion(ver.version)}
                      disabled={ver.is_current}
                    >
                      加载
                    </Button>
                  </Space>
                }
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    版本 v{ver.version}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    {ver.version_description || '无描述'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    创建时间: {new Date(ver.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
