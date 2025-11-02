/**
 * Prompt测试运行器页面 (CMS-305)
 * 艹！测试Prompt模板渲染和AI调用效果！
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Select,
  Form,
  Tag,
  Divider,
  Alert,
  Spin,
  Tabs,
  Table,
  Modal,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  CompareOutlined,
  CodeOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

// 动态导入Monaco编辑器
const MonacoEditor = dynamic(() => import('@/components/common/MonacoEditor'), {
  ssr: false,
  loading: () => <div style={{ padding: '48px', textAlign: 'center' }}>加载中...</div>,
});

const { TabPane } = Tabs;

/**
 * Prompt版本接口
 */
interface PromptVersion {
  id: number;
  prompt_id: string;
  version: number;
  is_current: boolean;
  publish_status: string;
  template: string;
  variables_schema?: any;
  description?: string;
  created_at: string;
}

/**
 * 测试结果接口
 */
interface TestResult {
  prompt_id: string;
  version: number;
  variables: any;
  rendered: string;
  missingVars?: string[];
  timestamp: string;
}

export default function PromptTestPage() {
  const [form] = Form.useForm();

  // Prompt列表
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // 选中的Prompt
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [selectedVersions, setSelectedVersions] = useState<PromptVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // 测试变量
  const [variablesJson, setVariablesJson] = useState<string>('{\n  "user": "张三",\n  "task": "图片美化"\n}');

  // 测试结果
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  /**
   * 加载Prompt列表
   */
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoadingPrompts(true);
    try {
      const response: any = await api.client.get('/admin/prompts', {
        params: { status: 'published' },
      });

      if (response.data?.success) {
        setPrompts(response.data.data.prompts || []);
      }
    } catch (error: any) {
      console.error('[加载Prompt列表失败]', error);
      message.error('加载Prompt列表失败');
    } finally {
      setLoadingPrompts(false);
    }
  };

  /**
   * 加载Prompt版本
   */
  const loadVersions = async (promptId: string) => {
    setLoadingVersions(true);
    try {
      const response: any = await api.client.get(`/admin/prompts/${promptId}/versions`);

      if (response.data?.success) {
        setSelectedVersions(response.data.data.versions || []);
      }
    } catch (error: any) {
      console.error('[加载版本失败]', error);
      message.error('加载版本失败');
    } finally {
      setLoadingVersions(false);
    }
  };

  /**
   * 切换选中的Prompt
   */
  const handlePromptChange = (promptId: string) => {
    setSelectedPromptId(promptId);
    setTestResults([]); // 清空测试结果
    loadVersions(promptId);
  };

  /**
   * 运行测试
   * 艹！渲染Prompt并（可选）调用AI API！
   */
  const handleRunTest = async (versions?: number[]) => {
    setTesting(true);
    try {
      // 解析变量JSON
      const variables = JSON.parse(variablesJson);

      // 要测试的版本
      const versionsToTest = versions || selectedVersions.map((v) => v.version);

      if (versionsToTest.length === 0) {
        message.warning('请先选择要测试的Prompt版本');
        setTesting(false);
        return;
      }

      const results: TestResult[] = [];

      // 遍历每个版本进行测试
      for (const version of versionsToTest) {
        const versionData = selectedVersions.find((v) => v.version === version);

        if (!versionData) {
          console.warn('[版本不存在]', version);
          continue;
        }

        // 调用预览API渲染Prompt
        const response: any = await api.client.post('/admin/prompts/preview', {
          template: versionData.template,
          variables,
        });

        if (response.data?.success) {
          const { result, missingVars } = response.data.data;

          results.push({
            prompt_id: selectedPromptId,
            version,
            variables,
            rendered: result,
            missingVars,
            timestamp: new Date().toISOString(),
          });
        } else {
          message.error(`版本${version}渲染失败: ${response.data?.error?.message}`);
        }
      }

      setTestResults(results);

      if (results.length > 0) {
        message.success(`成功测试${results.length}个版本`);
      }
    } catch (error: any) {
      console.error('[测试失败]', error);
      message.error(`测试失败: ${error.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  /**
   * 测试当前版本
   */
  const handleTestCurrent = () => {
    const currentVersion = selectedVersions.find((v) => v.is_current);
    if (currentVersion) {
      handleRunTest([currentVersion.version]);
    } else {
      message.warning('未找到当前版本');
    }
  };

  /**
   * 对比所有已发布版本
   */
  const handleComparePublished = () => {
    const publishedVersions = selectedVersions
      .filter((v) => v.publish_status === 'published')
      .map((v) => v.version);

    if (publishedVersions.length === 0) {
      message.warning('没有已发布的版本可供对比');
      return;
    }

    handleRunTest(publishedVersions);
  };

  /**
   * 结果表格列
   */
  const resultColumns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (version: number) => {
        const versionData = selectedVersions.find((v) => v.version === version);
        return (
          <Space>
            <Tag color="blue">V{version}</Tag>
            {versionData?.is_current && <Tag color="green">当前</Tag>}
            {versionData?.publish_status === 'published' && <Tag>已发布</Tag>}
          </Space>
        );
      },
    },
    {
      title: '缺失变量',
      dataIndex: 'missingVars',
      key: 'missingVars',
      render: (missingVars?: string[]) => {
        if (!missingVars || missingVars.length === 0) {
          return <Tag color="success">无</Tag>;
        }
        return (
          <Space wrap>
            {missingVars.map((varPath) => (
              <Tag key={varPath} color="red">
                {varPath}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '渲染结果长度',
      dataIndex: 'rendered',
      key: 'length',
      render: (rendered: string) => `${rendered.length} 字符`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TestResult) => (
        <Button
          size="small"
          icon={<CodeOutlined />}
          onClick={() => {
            // 艹！这里可以弹出Modal显示完整结果
            Modal.info({
              title: `版本 ${record.version} 渲染结果`,
              content: (
                <pre style={{ maxHeight: '400px', overflow: 'auto', fontSize: '12px' }}>
                  {record.rendered}
                </pre>
              ),
              width: 700,
            });
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <RocketOutlined style={{ fontSize: '20px' }} />
            <span style={{ fontSize: '18px', fontWeight: 600 }}>Prompt测试运行器</span>
            <Tag color="orange">CMS-305</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadPrompts} loading={loadingPrompts}>
              刷新列表
            </Button>
          </Space>
        }
      >
        <Alert
          message="功能说明"
          description={
            <div>
              <p style={{ margin: 0 }}>
                选择Prompt和版本，输入测试变量，预览渲染结果，对比不同版本的输出效果。
              </p>
            </div>
          }
          type="info"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />

        {/* Prompt选择 */}
        <Form form={form} layout="vertical">
          <Form.Item label="选择Prompt" required>
            <Select
              placeholder="请选择要测试的Prompt"
              value={selectedPromptId}
              onChange={handlePromptChange}
              loading={loadingPrompts}
              style={{ width: '100%' }}
            >
              {prompts.map((prompt) => (
                <Select.Option key={prompt.id} value={prompt.prompt_id}>
                  {prompt.prompt_id} (V{prompt.version})
                  {prompt.is_current && ' - 当前版本'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>

        {selectedPromptId && (
          <>
            <Divider />

            {/* 版本列表 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontWeight: 500, marginBottom: '12px' }}>
                可用版本 ({selectedVersions.length}):
              </div>
              {loadingVersions ? (
                <Spin tip="加载中..." />
              ) : (
                <Space wrap>
                  {selectedVersions.map((version) => (
                    <Tag
                      key={version.version}
                      color={version.is_current ? 'green' : version.publish_status === 'published' ? 'blue' : 'default'}
                    >
                      V{version.version} {version.description && `- ${version.description}`}
                    </Tag>
                  ))}
                </Space>
              )}
            </div>

            {/* 测试变量输入 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px' }}>测试变量 (JSON):</div>
              <MonacoEditor
                value={variablesJson}
                onChange={setVariablesJson}
                language="json"
                height={200}
                theme="vs-dark"
                showActions={true}
              />
            </div>

            {/* 操作按钮 */}
            <div style={{ marginBottom: '24px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleTestCurrent}
                  loading={testing}
                >
                  测试当前版本
                </Button>
                <Button
                  icon={<CompareOutlined />}
                  onClick={handleComparePublished}
                  loading={testing}
                >
                  对比已发布版本
                </Button>
              </Space>
            </div>

            <Divider />

            {/* 测试结果 */}
            {testResults.length > 0 && (
              <div>
                <div style={{ fontWeight: 500, marginBottom: '12px', fontSize: '16px' }}>
                  测试结果:
                </div>

                <Tabs defaultActiveKey="table">
                  <TabPane tab="列表视图" key="table">
                    <Table
                      dataSource={testResults}
                      columns={resultColumns}
                      rowKey={(record) => `${record.version}-${record.timestamp}`}
                      pagination={false}
                      size="small"
                    />
                  </TabPane>

                  <TabPane tab="详细对比" key="detail">
                    {testResults.map((result) => (
                      <Card
                        key={result.version}
                        size="small"
                        title={<Space>版本 {result.version}</Space>}
                        style={{ marginBottom: '16px' }}
                      >
                        <div style={{ marginBottom: '12px' }}>
                          <Space wrap>
                            <Tag color="blue">V{result.version}</Tag>
                            {result.missingVars && result.missingVars.length > 0 && (
                              <Tag color="red">缺失{result.missingVars.length}个变量</Tag>
                            )}
                            <Tag>{result.rendered.length} 字符</Tag>
                          </Space>
                        </div>
                        <div style={{ fontWeight: 500, marginBottom: '8px' }}>渲染结果:</div>
                        <pre
                          style={{
                            padding: '12px',
                            background: '#f5f5f5',
                            borderRadius: '4px',
                            overflow: 'auto',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            maxHeight: '300px',
                          }}
                        >
                          {result.rendered}
                        </pre>
                      </Card>
                    ))}
                  </TabPane>
                </Tabs>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
