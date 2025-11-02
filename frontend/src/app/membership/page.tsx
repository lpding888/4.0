'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Typography,
  Row,
  Col,
  Space,
  Radio,
  message,
  Modal,
  Spin,
  Divider,
  Tag,
  List
} from 'antd';
import {
  CrownOutlined,
  WechatOutlined,
  AlipayOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Title, Text, Paragraph } = Typography;

export default function MembershipPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const [loading, setLoading] = useState(false);
  const [paymentChannel, setPaymentChannel] = useState<'wechat' | 'alipay'>('wechat');
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // 检查登录状态
    if (!user) {
      router.push('/login');
    }

    // 清理定时器
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, [user, router, pollingTimer]);

  // 创建订单
  const handlePurchase = async () => {
    try {
      setLoading(true);
      
      const response: any = await api.membership.purchase(paymentChannel);
      
      if (response.success && response.data) {
        const { orderId: newOrderId, qrcodeUrl: newQrcodeUrl } = response.data;
        
        setOrderId(newOrderId);
        setQrcodeUrl(newQrcodeUrl);
        setModalVisible(true);
        
        // 开始轮询支付状态
        startPolling(newOrderId);
        
        message.success('订单创建成功,请扫码支付');
      } else {
        message.error(response.error?.message || '创建订单失败');
      }
    } catch (error: any) {
      message.error(error.message || '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 轮询支付状态
  const startPolling = (currentOrderId: string) => {
    // 每3秒查询一次
    const timer = setInterval(async () => {
      try {
        const response: any = await api.membership.status();
        
        if (response.success && response.data?.isMember) {
          // 支付成功
          clearInterval(timer);
          setModalVisible(false);
          
          message.success('支付成功!会员已开通');
          
          // 跳转到工作台
          setTimeout(() => {
            router.push('/workspace');
          }, 1500);
        }
      } catch (error) {
        console.error('查询支付状态失败', error);
      }
    }, 3000);

    setPollingTimer(timer);

    // 5分钟后自动停止轮询
    setTimeout(() => {
      clearInterval(timer);
    }, 5 * 60 * 1000);
  };

  // 关闭支付弹窗
  const handleCloseModal = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }
    setModalVisible(false);
    setQrcodeUrl('');
    setOrderId('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 返回按钮 */}
        <Button 
          onClick={() => router.back()} 
          style={{ marginBottom: '24px' }}
        >
          ← 返回
        </Button>

        {/* 页面标题 */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <Title level={1} style={{ color: '#1F2937', marginBottom: '16px' }}>
            <CrownOutlined style={{ color: '#92400E' }} /> 开通会员
          </Title>
          <Text style={{ color: '#6B7280', fontSize: '18px' }}>
            解锁AI服装处理全部功能,提升您的业务效率
          </Text>
        </div>

        <Row gutter={[24, 24]}>
          {/* 会员权益 */}
          <Col xs={24} md={14}>
            <Card 
              title={
                <Space>
                  <CrownOutlined style={{ color: '#faad14' }} />
                  <span>会员权益</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <List
                dataSource={[
                  {
                    icon: <ThunderboltOutlined style={{ color: '#1890ff', fontSize: '24px' }} />,
                    title: '100次AI处理配额',
                    desc: '基础修图 + AI模特上身,每月100次处理机会'
                  },
                  {
                    icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '24px' }} />,
                    title: '多种AI处理功能',
                    desc: '商品抠图、白底处理、12分镜AI模特上身'
                  },
                  {
                    icon: <ClockCircleOutlined style={{ color: '#faad14', fontSize: '24px' }} />,
                    title: '优先处理队列',
                    desc: '会员任务优先处理,更快获得结果'
                  },
                  {
                    icon: <CheckCircleOutlined style={{ color: '#722ed1', fontSize: '24px' }} />,
                    title: '无限历史记录',
                    desc: '永久保存处理记录,随时查看和下载'
                  }
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={item.icon}
                      title={<Text strong style={{ fontSize: '16px' }}>{item.title}</Text>}
                      description={item.desc}
                    />
                  </List.Item>
                )}
              />

              <Divider />

              <div style={{ background: '#f6f8fa', padding: '16px', borderRadius: '8px' }}>
                <Title level={5}>使用场景:</Title>
                <ul style={{ marginBottom: 0 }}>
                  <li>电商商品图片批量处理</li>
                  <li>服装展示图自动生成</li>
                  <li>多场景模特图快速制作</li>
                  <li>提升商品页面视觉效果</li>
                </ul>
              </div>
            </Card>
          </Col>

          {/* 购买卡片 */}
          <Col xs={24} md={10}>
            <Card
              style={{
                background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                border: 'none'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Tag color="gold" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  限时优惠
                </Tag>
                <Title level={2} style={{ margin: '16px 0 8px' }}>
                  ¥99
                  <Text type="secondary" style={{ fontSize: '16px', marginLeft: '8px' }}>
                    /月
                  </Text>
                </Title>
                <Text type="secondary" delete>
                  原价 ¥199/月
                </Text>
              </div>

              <Card style={{ marginBottom: '24px' }}>
                <Title level={5}>套餐包含:</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>AI处理次数</Text>
                    <Text strong>100次</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>有效期</Text>
                    <Text strong>30天</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>平均成本</Text>
                    <Text strong type="danger">¥0.99/次</Text>
                  </div>
                </Space>
              </Card>

              <div style={{ marginBottom: '24px' }}>
                <Text strong style={{ marginBottom: '12px', display: 'block' }}>
                  选择支付方式:
                </Text>
                <Radio.Group
                  value={paymentChannel}
                  onChange={(e) => setPaymentChannel(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="wechat" style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px'
                    }}>
                      <Space>
                        <WechatOutlined style={{ color: '#07c160', fontSize: '20px' }} />
                        <span>微信支付</span>
                      </Space>
                    </Radio>
                    <Radio value="alipay" style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px'
                    }}>
                      <Space>
                        <AlipayOutlined style={{ color: '#1677ff', fontSize: '20px' }} />
                        <span>支付宝支付</span>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>

              <Button
                type="primary"
                size="large"
                icon={<CrownOutlined />}
                loading={loading}
                onClick={handlePurchase}
                block
                style={{ height: '50px', fontSize: '18px' }}
              >
                立即开通会员
              </Button>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  购买即代表同意
                  <a href="#" style={{ color: '#1890ff' }}> 会员服务协议</a>
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 支付二维码弹窗 */}
      <Modal
        title="扫码支付"
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        centered
      >
        <div style={{ textAlign: 'center', padding: '24px' }}>
          {qrcodeUrl ? (
            <>
              <div style={{ 
                width: '200px', 
                height: '200px', 
                margin: '0 auto 24px',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img src={qrcodeUrl} alt="支付二维码" style={{ maxWidth: '100%' }} />
              </div>
              <Paragraph>
                <Text strong>订单号: {orderId}</Text>
              </Paragraph>
              <Paragraph type="secondary">
                请使用{paymentChannel === 'wechat' ? '微信' : '支付宝'}扫描二维码完成支付
              </Paragraph>
              <Spin tip="等待支付中..." />
            </>
          ) : (
            <Spin size="large" />
          )}
        </div>
      </Modal>
    </div>
  );
}
