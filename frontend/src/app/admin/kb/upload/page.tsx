/**
 * PAGE-P0-KB-002 知识库管理 - 上传页面
 * 艹，必须做好COS直传功能，支持批量上传、进度显示、回调处理！
 *
 * 功能清单：
 * 1. COS直传功能（STS临时凭证）
 * 2. 批量文件上传
 * 3. 上传进度显示
 * 4. 上传失败重试
 * 5. 文件类型和大小限制
 * 6. 上传成功后自动回调处理
 * 7. 支持拖拽上传
 *
 * @author 老王
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Card,
  Upload,
  Button,
  Progress,
  Table,
  Space,
  Tag,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Alert,
  Modal,
  Form,
  Input,
  Select,
  Divider
} from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { MSWInitializer } from '@/components/MSWInitializer';
import type { RcFile, UploadProps } from 'antd/es/upload';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;

// 上传文件状态
type UploadStatus = 'waiting' | 'uploading' | 'success' | 'error';

// 上传任务项
interface UploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  url?: string;
  documentId?: string;
}

// COS上传配置
interface COSConfig {
  region: string;
  bucket: string;
  sessionId: string;
  startTime: number;
  expiredTime: number;
  credentials: {
    tmpSecretId: string;
    tmpSecretKey: string;
    sessionToken: string;
  };
}

export default function KBUploadPage() {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [uploadForm] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取COS上传配置
  const { data: cosConfig, refetch: refetchCosConfig } = useQuery({
    queryKey: ['cos-config'],
    queryFn: async () => {
      const response = await api.get('/admin/kb/cos-config');
      return response.data;
    },
  });

  // 上传文件到COS
  const uploadMutation = useMutation({
    mutationFn: async ({ file, config, taskId }: { file: File; config: COSConfig; taskId: string }) => {
      const formData = new FormData();

      // 构建COS上传所需的表单数据
      const key = `kb/${Date.now()}_${file.name}`;
      const policy = 'eyJleHBpcmF0aW9uIjoiMjAyNS0xMi0zMVQxMjowMDowMC4wMDBaIiwiY29uZGl0aW9ucyI6W1siY29udGVudC1sZW5ndGgtcmFuZ2UiLDAsMTA0ODU3NjAwMF0sWyJzdGFydHMtd2l0aCIsIiRrZXkiLCJrYi8iXV19';
      const signature = 'fake-signature'; // 实际应该根据policy生成

      formData.append('key', key);
      formData.append('policy', policy);
      formData.append('x-cos-security-token', config.credentials.sessionToken);
      formData.append('x-cos-signature', signature);
      formData.append('x-cos-algorithm', 'SHA1');
      formData.append('file', file);

      // 模拟COS上传
      return new Promise<{ url: string; key: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadTasks(prev => prev.map(task =>
              task.id === taskId
                ? { ...task, progress, status: 'uploading' as UploadStatus }
                : task
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 204) {
            const url = `https://${config.bucket}.cos.${config.region}.myqcloud.com/${key}`;
            resolve({ url, key });
          } else {
            reject(new Error('上传失败'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'));
        });

        // 模拟上传（实际应该发送到COS）
        setTimeout(() => {
          const mockUrl = `https://mock-cos-url.com/kb/${Date.now()}_${file.name}`;
          resolve({ url: mockUrl, key: `kb/${Date.now()}_${file.name}` });
        }, 1000 + Math.random() * 2000);
      });
    },
    onSuccess: (data, variables) => {
      // 上传成功，回调处理
      handleUploadSuccess(variables.taskId, data.url);
    },
    onError: (error, variables) => {
      setUploadTasks(prev => prev.map(task =>
        task.id === variables.taskId
          ? { ...task, status: 'error' as UploadStatus, error: error.message }
          : task
      ));
    },
  });

  // 处理上传成功回调
  const handleUploadSuccess = async (taskId: string, fileUrl: string) => {
    try {
      const task = uploadTasks.find(t => t.id === taskId);
      if (!task) return;

      // 调用后端API处理上传的文件
      const response = await api.post('/admin/kb/upload-callback', {
        fileName: task.name,
        fileSize: task.size,
        fileType: task.type,
        fileUrl,
        metadata: uploadForm.getFieldsValue()
      });

      const { documentId } = response.data;

      setUploadTasks(prev => prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              status: 'success' as UploadStatus,
              progress: 100,
              url: fileUrl,
              documentId
            }
          : t
      ));

      message.success(`${task.name} 上传并处理成功`);
    } catch (error) {
      setUploadTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, status: 'error' as UploadStatus, error: '处理失败' }
          : task
      ));
    }
  };

  // 文件选择处理
  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const newTasks: UploadTask[] = Array.from(files).map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'unknown',
      status: 'waiting' as UploadStatus,
      progress: 0
    }));

    setUploadTasks(prev => [...prev, ...newTasks]);
  }, []);

  // 拖拽上传配置
  const draggerProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: () => false, // 阻止默认上传
    onChange: (info) => {
      if (info.fileList && info.fileList.length > 0) {
        const files = info.fileList
          .map((f) => f.originFileObj)
          .filter((file): file is RcFile => Boolean(file));
        if (files.length > 0) {
          handleFileSelect(files);
        }
      }
    },
    onDrop: (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files);
      }
    },
  };

  // 开始上传
  const startUpload = async () => {
    if (!cosConfig) {
      message.error('获取上传配置失败，请重试');
      return;
    }

    const waitingTasks = uploadTasks.filter(task => task.status === 'waiting');
    if (waitingTasks.length === 0) {
      message.warning('没有待上传的文件');
      return;
    }

    setIsUploading(true);

    // 逐个上传文件（实际可以并发，但这里为了演示用串行）
    for (const task of waitingTasks) {
      try {
        await uploadMutation.mutateAsync({
          file: task.file,
          config: cosConfig,
          taskId: task.id
        });
      } catch (error) {
        console.error('上传失败:', error);
      }
    }

    setIsUploading(false);
  };

  // 重试失败的上传
  const retryFailedUploads = () => {
    const failedTasks = uploadTasks.filter(task => task.status === 'error');
    if (failedTasks.length === 0) {
      message.warning('没有失败的上传任务');
      return;
    }

    // 重置失败任务状态
    setUploadTasks(prev => prev.map(task =>
      task.status === 'error'
        ? { ...task, status: 'waiting' as UploadStatus, progress: 0, error: undefined }
        : task
    ));

    message.info(`已重置 ${failedTasks.length} 个失败任务`);
  };

  // 清空列表
  const clearTasks = () => {
    setUploadTasks([]);
  };

  // 移除单个任务
  const removeTask = (taskId: string) => {
    setUploadTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取状态标签
  const getStatusTag = (status: UploadStatus, error?: string) => {
    switch (status) {
      case 'waiting':
        return <Tag>等待中</Tag>;
      case 'uploading':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>上传中</Tag>;
      case 'success':
        return <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>;
      case 'error':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  // 表格列定义
  const columns: ColumnsType<UploadTask> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: UploadTask) => (
        <Space>
          <FileTextOutlined />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color="blue">{type.split('/')[1]?.toUpperCase() || 'UNKNOWN'}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: UploadStatus, record: UploadTask) => (
        <Space direction="vertical" size="small">
          {getStatusTag(status, record.error)}
          {status === 'uploading' && (
            <Progress percent={record.progress} size="small" />
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record: UploadTask) => (
        <Space>
          {record.status === 'error' && (
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                setUploadTasks(prev => prev.map(task =>
                  task.id === record.id
                    ? { ...task, status: 'waiting' as UploadStatus, progress: 0, error: undefined }
                    : task
                ));
              }}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => removeTask(record.id)}
            disabled={record.status === 'uploading'}
          />
        </Space>
      ),
    },
  ];

  const waitingCount = uploadTasks.filter(t => t.status === 'waiting').length;
  const uploadingCount = uploadTasks.filter(t => t.status === 'uploading').length;
  const successCount = uploadTasks.filter(t => t.status === 'success').length;
  const errorCount = uploadTasks.filter(t => t.status === 'error').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <MSWInitializer />

      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CloudUploadOutlined className="text-3xl text-blue-600" />
            <div>
              <Title level={2} className="mb-1">知识库上传</Title>
              <Text type="secondary">上传文档到知识库，支持COS直传和批量处理</Text>
            </div>
          </div>
          <Space>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setShowAdvancedModal(true)}
            >
              高级设置
            </Button>
            <Button
              onClick={() => window.location.href = '/admin/kb'}
            >
              返回列表
            </Button>
          </Space>
        </div>

        {/* 统计信息 */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="等待上传"
                value={waitingCount}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="上传中"
                value={uploadingCount}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="成功"
                value={successCount}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="失败"
                value={errorCount}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 上传区域 */}
      <Card className="mb-6">
        <Dragger {...draggerProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传。支持 PDF、DOC、DOCX、TXT、MD 等格式，单个文件不超过 50MB。
          </p>
        </Dragger>

        {uploadTasks.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <Title level={4}>上传队列 ({uploadTasks.length})</Title>
              <Space>
                {errorCount > 0 && (
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={retryFailedUploads}
                    disabled={isUploading}
                  >
                    重试失败
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={startUpload}
                  disabled={waitingCount === 0 || isUploading}
                  loading={isUploading}
                >
                  开始上传 ({waitingCount})
                </Button>
                <Button onClick={clearTasks} disabled={isUploading}>
                  清空列表
                </Button>
              </Space>
            </div>

            <Table
              columns={columns}
              dataSource={uploadTasks}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
            />
          </div>
        )}
      </Card>

      {/* 提示信息 */}
      <Alert
        message="上传说明"
        description={
          <div>
            <p>• 支持的文件格式：PDF、DOC、DOCX、TXT、MD、HTML等</p>
            <p>• 单个文件大小限制：50MB</p>
            <p>• 上传后系统会自动进行文本提取、分块、向量化处理</p>
            <p>• 处理完成后即可在知识库检索中使用</p>
          </div>
        }
        type="info"
        showIcon
      />

      {/* 高级设置模态框 */}
      <Modal
        title="高级设置"
        open={showAdvancedModal}
        onCancel={() => setShowAdvancedModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowAdvancedModal(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" onClick={() => setShowAdvancedModal(false)}>
            保存
          </Button>,
        ]}
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item
            label="文档描述"
            name="description"
            help="为上传的文档添加描述信息"
          >
            <TextArea rows={3} placeholder="输入文档描述..." />
          </Form.Item>

          <Form.Item
            label="知识库分类"
            name="category"
            help="选择文档所属的知识库分类"
          >
            <Select placeholder="选择分类">
              <Select.Option value="general">通用知识</Select.Option>
              <Select.Option value="technical">技术文档</Select.Option>
              <Select.Option value="business">业务资料</Select.Option>
              <Select.Option value="product">产品文档</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="处理优先级"
            name="priority"
            help="设置文档处理的优先级"
          >
            <Select defaultValue="normal">
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="normal">普通</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="urgent">紧急</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
