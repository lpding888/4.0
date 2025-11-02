/**
 * Pipeline测试运行器页面
 * 艹！使用新的GPT5架构，支持mock/真实模式！
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Space,
  Radio,
  message,
  Timeline,
  Tag,
  Alert,
  Descriptions,
  Spin,
  Empty,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/shared/api/client';

/**
 * 步骤日志类型
 */
interface StepLog {
  stepId: string;
  stepIndex: number;
  type: string;
  providerRef: string;
  status: 'processing' | 'success' | 'failed';
  startTime: string;
  endTime?: string;
  latency?: number;
  input: any;
  output?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * 测试结果类型
 */
interface TestResult {
  success: boolean;
  testId: string;
  mode: 'mock' | 'real';
  logs: StepLog[];
  finalOutput?: any;
  failedAtStep?: number;
  error?: {
    message: string;
    stepId: string;
  };
}

export default function PipelineTestPage() {
  const params = useParams();
  const router = useRouter();
  const pipelineId = params.id as string;

  const [mode, setMode] = useState<'mock' | 'real'>('mock');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  /**
   * 运行测试
   * 艹！调用后端API执行测试！
   */
  const handleRunTest = async () => {
    try {
      setLoading(true);
      setTestResult(null);

      // 调用后端测试接口
      const response = await apiClient.post(`/admin/pipelines/${pipelineId}/test`, {
        mode,
        inputData: {
          // 艹，这里可以让用户输入测试数据，现在先用默认的
          testMode: true,
          timestamp: new Date().toISOString(),
        },
      });

      setTestResult(response.data);

      if (response.data.success) {
        message.success(`测试成功！testId=${response.data.testId}`);
      } else {
        message.error(`测试失败：${response.data.error?.message}`);
      }
    } catch (error: any) {
      console.error('[测试运行] 失败', error);
      message.error(error.response?.data?.error?.message || '测试运行失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 渲染步骤状态图标
   */
  const renderStepIcon = (status: StepLog['status']) => {
    switch (status) {
      case 'processing':
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    }
  };

  /**
   * 渲染步骤标签
   */
  const renderStepTag = (status: StepLog['status']) => {
    switch (status) {
      case 'processing':
        return <Tag color="processing">执行中</Tag>;
      case 'success':
        return <Tag color="success">成功</Tag>;
      case 'failed':
        return <Tag color="error">失败</Tag>;
    }
  };

  /**
   * 格式化延迟
   */
  const formatLatency = (latency?: number) => {
    if (!latency) return '-';
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(2)}s`;
  };

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
        Pipeline 测试运行器
      </h1>

      {/* 控制面板 */}
      <Card style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 模式选择 */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>运行模式：</div>
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
              <Radio.Button value="mock">
                Mock模式（模拟执行，不调用真实API）
              </Radio.Button>
              <Radio.Button value="real">真实模式（调用真实Provider）</Radio.Button>
            </Radio.Group>
          </div>

          {/* 说明 */}
          <Alert
            message="测试说明"
            description={
              mode === 'mock'
                ? '🎭 Mock模式会模拟Provider执行，不调用真实API，不消耗配额，用于快速验证Pipeline拓扑和逻辑。'
                : '⚡ 真实模式会调用真实Provider，但测试数据不计入业务账单，不扣除用户配额。'
            }
            type="info"
            showIcon
          />

          {/* 运行按钮 */}
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            loading={loading}
            onClick={handleRunTest}
          >
            运行测试
          </Button>
        </Space>
      </Card>

      {/* 测试结果 */}
      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" tip="测试运行中..." />
          </div>
        </Card>
      )}

      {!loading && testResult && (
        <>
          {/* 测试概览 */}
          <Card title="测试概览" style={{ marginBottom: '24px' }}>
            <Descriptions column={2}>
              <Descriptions.Item label="测试ID">{testResult.testId}</Descriptions.Item>
              <Descriptions.Item label="运行模式">
                <Tag color={testResult.mode === 'mock' ? 'blue' : 'orange'}>
                  {testResult.mode === 'mock' ? 'Mock模式' : '真实模式'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="测试结果">
                {testResult.success ? (
                  <Tag color="success">✅ 成功</Tag>
                ) : (
                  <Tag color="error">❌ 失败</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="执行步骤数">
                {testResult.logs.length} 个步骤
              </Descriptions.Item>
            </Descriptions>

            {testResult.error && (
              <Alert
                style={{ marginTop: '16px' }}
                message="测试失败"
                description={testResult.error.message}
                type="error"
                showIcon
              />
            )}
          </Card>

          {/* 步骤日志（时间线） */}
          <Card title="执行日志">
            {testResult.logs.length === 0 ? (
              <Empty description="无日志" />
            ) : (
              <Timeline>
                {testResult.logs.map((log, index) => (
                  <Timeline.Item
                    key={log.stepId}
                    dot={renderStepIcon(log.status)}
                    color={
                      log.status === 'success'
                        ? 'green'
                        : log.status === 'failed'
                        ? 'red'
                        : 'blue'
                    }
                  >
                    <div>
                      {/* 步骤标题 */}
                      <div style={{ marginBottom: '8px' }}>
                        <Space>
                          <span style={{ fontWeight: 600, fontSize: '16px' }}>
                            步骤 {index + 1}
                          </span>
                          {renderStepTag(log.status)}
                          <Tag>{log.type}</Tag>
                          {log.latency && (
                            <Tag color="cyan">{formatLatency(log.latency)}</Tag>
                          )}
                        </Space>
                      </div>

                      {/* 步骤详情 */}
                      <Descriptions size="small" column={1} bordered>
                        <Descriptions.Item label="Provider类型">{log.type}</Descriptions.Item>
                        <Descriptions.Item label="Provider引用">
                          {log.providerRef || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="开始时间">
                          {new Date(log.startTime).toLocaleString('zh-CN')}
                        </Descriptions.Item>
                        {log.endTime && (
                          <Descriptions.Item label="结束时间">
                            {new Date(log.endTime).toLocaleString('zh-CN')}
                          </Descriptions.Item>
                        )}
                        <Descriptions.Item label="输入数据">
                          <pre
                            style={{
                              margin: 0,
                              fontSize: '12px',
                              maxHeight: '100px',
                              overflow: 'auto',
                            }}
                          >
                            {JSON.stringify(log.input, null, 2)}
                          </pre>
                        </Descriptions.Item>
                        {log.output && (
                          <Descriptions.Item label="输出数据">
                            <pre
                              style={{
                                margin: 0,
                                fontSize: '12px',
                                maxHeight: '100px',
                                overflow: 'auto',
                              }}
                            >
                              {JSON.stringify(log.output, null, 2)}
                            </pre>
                          </Descriptions.Item>
                        )}
                        {log.error && (
                          <Descriptions.Item label="错误信息">
                            <Alert
                              message={log.error.code}
                              description={log.error.message}
                              type="error"
                              showIcon
                            />
                            {log.error.details && (
                              <pre
                                style={{
                                  marginTop: '8px',
                                  fontSize: '12px',
                                  maxHeight: '100px',
                                  overflow: 'auto',
                                }}
                              >
                                {JSON.stringify(log.error.details, null, 2)}
                              </pre>
                            )}
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
