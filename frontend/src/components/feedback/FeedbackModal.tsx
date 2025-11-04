'use client';

/**
 * 反馈Modal组件
 * 艹！这个Modal让用户提交反馈、打分、上传截图！
 *
 * @author 老王
 */

import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Rate,
  Upload,
  Button,
  message,
  Space,
  Typography,
  Divider,
  Alert,
  Row,
  Col,
  Card,
} from 'antd';
import {
  MessageOutlined,
  SmileOutlined,
  MehOutlined,
  FrownOutlined,
  UploadOutlined,
  CameraOutlined,
  StarOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { TextArea } = Input;
const { Text, Title } = Typography;

/**
 * 反馈类型
 */
export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'complaint' | 'praise' | 'other';

/**
 * NPS评分（0-10）
 */
export type NPSScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * 反馈表单数据
 */
interface FeedbackFormData {
  nps_score?: NPSScore; // NPS评分
  feedback_type: FeedbackType; // 反馈类型
  title: string; // 反馈标题
  content: string; // 反馈内容
  contact?: string; // 联系方式（可选）
}

/**
 * FeedbackModal Props
 */
interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * 反馈类型配置
 */
const FEEDBACK_TYPE_CONFIG: Record<FeedbackType, { label: string; color: string }> = {
  bug: { label: '错误反馈', color: 'red' },
  feature: { label: '功能建议', color: 'blue' },
  improvement: { label: '优化建议', color: 'cyan' },
  complaint: { label: '投诉建议', color: 'orange' },
  praise: { label: '表扬鼓励', color: 'green' },
  other: { label: '其他反馈', color: 'default' },
};

/**
 * NPS评分区间配置
 */
const NPS_RANGES = {
  detractor: { min: 0, max: 6, label: '贬损者', color: '#ff4d4f', icon: <FrownOutlined /> },
  passive: { min: 7, max: 8, label: '中立者', color: '#faad14', icon: <MehOutlined /> },
  promoter: { min: 9, max: 10, label: '推荐者', color: '#52c41a', icon: <SmileOutlined /> },
};

/**
 * 反馈Modal
 */
export const FeedbackModal: React.FC<FeedbackModalProps> = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm<FeedbackFormData>();
  const [loading, setLoading] = useState(false);
  const [npsScore, setNpsScore] = useState<NPSScore | undefined>(undefined);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [step, setStep] = useState<'nps' | 'feedback'>('nps');

  /**
   * 获取NPS评分区间
   */
  const getNPSRange = (score?: NPSScore) => {
    if (score === undefined) return null;

    if (score >= NPS_RANGES.promoter.min && score <= NPS_RANGES.promoter.max) {
      return NPS_RANGES.promoter;
    } else if (score >= NPS_RANGES.passive.min && score <= NPS_RANGES.passive.max) {
      return NPS_RANGES.passive;
    } else {
      return NPS_RANGES.detractor;
    }
  };

  /**
   * NPS评分选择
   */
  const handleNPSScoreSelect = (score: NPSScore) => {
    setNpsScore(score);
    form.setFieldsValue({ nps_score: score });

    // 延迟进入下一步
    setTimeout(() => {
      setStep('feedback');
    }, 300);
  };

  /**
   * 提交反馈
   */
  const handleSubmit = async (values: FeedbackFormData) => {
    setLoading(true);

    try {
      // 准备上传的截图
      const screenshots = fileList.map((file) => file.originFileObj);

      // 构建FormData
      const formData = new FormData();
      formData.append('nps_score', npsScore?.toString() || '');
      formData.append('feedback_type', values.feedback_type);
      formData.append('title', values.title);
      formData.append('content', values.content);
      if (values.contact) {
        formData.append('contact', values.contact);
      }

      // 添加截图
      screenshots.forEach((file, index) => {
        if (file) {
          formData.append(`screenshot_${index}`, file);
        }
      });

      // 提交反馈
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`提交反馈失败: ${response.status}`);
      }

      message.success('感谢您的反馈！我们会认真处理！');
      handleReset();
      onClose();

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('[反馈提交] 提交失败:', error);
      message.error(error.message || '提交反馈失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 重置表单
   */
  const handleReset = () => {
    form.resetFields();
    setNpsScore(undefined);
    setFileList([]);
    setStep('nps');
  };

  /**
   * 取消
   */
  const handleCancel = () => {
    handleReset();
    onClose();
  };

  /**
   * 截图上传
   */
  const handleScreenshotUpload = async (file: File) => {
    // 检查文件大小（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过5MB');
      return false;
    }

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      message.error('只能上传图片文件');
      return false;
    }

    return false; // 阻止自动上传
  };

  const npsRange = getNPSRange(npsScore);

  return (
    <Modal
      title={
        <span>
          <MessageOutlined style={{ marginRight: 8 }} />
          用户反馈
        </span>
      }
      open={open}
      onCancel={handleCancel}
      footer={
        step === 'feedback'
          ? [
              <Button key="back" onClick={() => setStep('nps')}>
                上一步
              </Button>,
              <Button key="cancel" onClick={handleCancel}>
                取消
              </Button>,
              <Button key="submit" type="primary" loading={loading} onClick={() => form.submit()}>
                提交反馈
              </Button>,
            ]
          : null
      }
      width={700}
      destroyOnClose
    >
      {/* 第一步：NPS评分 */}
      {step === 'nps' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={4}>您有多大可能向朋友推荐我们的产品？</Title>
            <Text type="secondary">请在0-10分之间选择（0=完全不可能，10=非常可能）</Text>
          </div>

          {/* NPS评分按钮 */}
          <Row gutter={[8, 8]} style={{ marginBottom: 24 }}>
            {Array.from({ length: 11 }, (_, i) => i as NPSScore).map((score) => (
              <Col span={4} key={score} style={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  size="large"
                  type={npsScore === score ? 'primary' : 'default'}
                  onClick={() => handleNPSScoreSelect(score)}
                  style={{
                    width: '100%',
                    height: 56,
                    fontSize: 18,
                    fontWeight: 'bold',
                    backgroundColor:
                      npsScore === score
                        ? undefined
                        : score >= 9
                          ? 'rgba(82, 196, 26, 0.1)'
                          : score >= 7
                            ? 'rgba(250, 173, 20, 0.1)'
                            : 'rgba(255, 77, 79, 0.1)',
                    borderColor:
                      npsScore === score
                        ? undefined
                        : score >= 9
                          ? '#52c41a'
                          : score >= 7
                            ? '#faad14'
                            : '#ff4d4f',
                    color:
                      npsScore === score
                        ? undefined
                        : score >= 9
                          ? '#52c41a'
                          : score >= 7
                            ? '#faad14'
                            : '#ff4d4f',
                  }}
                >
                  {score}
                </Button>
              </Col>
            ))}
          </Row>

          {/* NPS评分说明 */}
          <Row gutter={16}>
            <Col span={8}>
              <Card
                size="small"
                style={{
                  background: 'rgba(255, 77, 79, 0.05)',
                  borderColor: '#ff4d4f',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, color: '#ff4d4f', marginBottom: 8 }}>
                    {NPS_RANGES.detractor.icon}
                  </div>
                  <Text strong style={{ color: '#ff4d4f' }}>
                    {NPS_RANGES.detractor.label}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    0-6分
                  </Text>
                </div>
              </Card>
            </Col>

            <Col span={8}>
              <Card
                size="small"
                style={{
                  background: 'rgba(250, 173, 20, 0.05)',
                  borderColor: '#faad14',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, color: '#faad14', marginBottom: 8 }}>
                    {NPS_RANGES.passive.icon}
                  </div>
                  <Text strong style={{ color: '#faad14' }}>
                    {NPS_RANGES.passive.label}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    7-8分
                  </Text>
                </div>
              </Card>
            </Col>

            <Col span={8}>
              <Card
                size="small"
                style={{
                  background: 'rgba(82, 196, 26, 0.05)',
                  borderColor: '#52c41a',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }}>
                    {NPS_RANGES.promoter.icon}
                  </div>
                  <Text strong style={{ color: '#52c41a' }}>
                    {NPS_RANGES.promoter.label}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    9-10分
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Button type="link" onClick={() => setStep('feedback')}>
              跳过评分，直接反馈
            </Button>
          </div>
        </div>
      )}

      {/* 第二步：详细反馈 */}
      {step === 'feedback' && (
        <div>
          {/* NPS评分总结 */}
          {npsRange && (
            <Alert
              message={
                <Space>
                  <span>您的评分：</span>
                  <Text strong style={{ fontSize: 18, color: npsRange.color }}>
                    {npsScore}分
                  </Text>
                  <span>|</span>
                  <Text style={{ color: npsRange.color }}>
                    {npsRange.icon} {npsRange.label}
                  </Text>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            {/* 反馈类型 */}
            <Form.Item
              label="反馈类型"
              name="feedback_type"
              rules={[{ required: true, message: '请选择反馈类型' }]}
            >
              <Select
                placeholder="请选择反馈类型"
                options={Object.entries(FEEDBACK_TYPE_CONFIG).map(([value, config]) => ({
                  label: config.label,
                  value,
                }))}
              />
            </Form.Item>

            {/* 反馈标题 */}
            <Form.Item
              label="反馈标题"
              name="title"
              rules={[{ required: true, message: '请输入反馈标题' }]}
            >
              <Input placeholder="简要描述您的反馈（10-50字）" maxLength={50} showCount />
            </Form.Item>

            {/* 反馈内容 */}
            <Form.Item
              label="详细描述"
              name="content"
              rules={[{ required: true, message: '请输入详细描述' }]}
            >
              <TextArea
                rows={6}
                placeholder="请详细描述您的反馈，包括问题现象、复现步骤、期望结果等"
                maxLength={1000}
                showCount
              />
            </Form.Item>

            {/* 截图上传 */}
            <Form.Item label="截图附件（选填）" tooltip="最多上传3张截图，每张不超过5MB">
              <Upload
                listType="picture-card"
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList.slice(0, 3))}
                beforeUpload={handleScreenshotUpload}
                maxCount={3}
                accept="image/*"
              >
                {fileList.length < 3 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上传截图</div>
                  </div>
                )}
              </Upload>
            </Form.Item>

            {/* 联系方式 */}
            <Form.Item label="联系方式（选填）" name="contact">
              <Input placeholder="邮箱或手机号，方便我们与您联系" />
            </Form.Item>
          </Form>

          {/* 温馨提示 */}
          <Alert
            message="温馨提示"
            description={
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                <li>我们会在1-3个工作日内处理您的反馈</li>
                <li>如果留下联系方式，我们会及时回复处理结果</li>
                <li>感谢您帮助我们改进产品！</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      )}
    </Modal>
  );
};
