'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Empty,
  Button,
  Space
} from 'antd';
import { LoginOutlined, CrownOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Feature } from '@/types';
import FeatureCard from '@/components/FeatureCard';

const { Title, Paragraph, Text } = Typography;

/**
 * HomePage - 首页
 *
 * 艹！用户可以不登录就浏览所有功能，点击使用时才要求登录！
 */
export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取所有启用的功能
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const response: any = await api.features.getAll({ enabled: true });

        if (response.success && response.data) {
          setFeatures(response.data);
        }
      } catch (error: any) {
        // 不显示错误，静默失败
        console.error('获取功能列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  // 按 category 分组功能卡片
  const groupFeaturesByCategory = () => {
    const grouped: Record<string, Feature[]> = {};
    features.forEach((feature) => {
      if (!grouped[feature.category]) {
        grouped[feature.category] = [];
      }
      grouped[feature.category].push(feature);
    });
    return grouped;
  };

  // 处理功能卡片点击 - 未登录跳转登录页
  const handleFeatureClick = (featureId: string) => {
    if (!user) {
      // 未登录，跳转登录页
      router.push('/login');
    } else {
      // 已登录，跳转创建任务页
      router.push(`/task/create/${featureId}`);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="加载功能列表..." />
      </div>
    );
  }

  const groupedFeatures = groupFeaturesByCategory();

  return (
    <div style={{
      padding: '24px',
      minHeight: '100vh',
      background: '#f0f2f5'
    }}>
      {/* 顶部Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '48px 24px',
        marginBottom: '32px',
        borderRadius: '12px',
        color: 'white',
        textAlign: 'center'
      }}>
        <Title level={1} style={{ color: 'white', marginBottom: '16px' }}>
          AI服装处理平台
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: '18px', marginBottom: '24px' }}>
          专业的AI服装图片处理服务 · 基础修图 · AI模特上身 · 视频生成
        </Paragraph>

        {user ? (
          <Button
            type="primary"
            size="large"
            icon={<CrownOutlined />}
            onClick={() => router.push('/workspace')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderColor: 'rgba(255,255,255,0.3)',
              height: '48px',
              fontSize: '16px',
              padding: '0 32px'
            }}
          >
            进入工作台
          </Button>
        ) : (
          <Space size="large">
            <Button
              type="primary"
              size="large"
              icon={<LoginOutlined />}
              onClick={() => router.push('/login')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                borderColor: 'rgba(255,255,255,0.3)',
                height: '48px',
                fontSize: '16px',
                padding: '0 32px'
              }}
            >
              登录/注册
            </Button>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
              👇 浏览下方功能，点击使用时需要登录
            </Text>
          </Space>
        )}
      </div>

      {/* 功能区域 - 动态渲染功能卡片 */}
      {features.length === 0 ? (
        <Card>
          <Empty description="暂无可用功能" />
        </Card>
      ) : (
        Object.keys(groupedFeatures).map((category) => (
          <Card
            key={category}
            title={category}
            style={{ marginBottom: '24px' }}
          >
            <Row gutter={[16, 16]}>
              {groupedFeatures[category].map((feature) => (
                <Col key={feature.feature_id} xs={24} sm={12} lg={12} xl={6}>
                  <div onClick={() => handleFeatureClick(feature.feature_id)}>
                    <FeatureCard
                      feature={feature}
                      disabled={false} // 首页不禁用任何功能，都可以查看
                      onUpgrade={() => {}} // 首页不需要升级逻辑
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        ))
      )}

      {/* 底部说明 */}
      {!user && (
        <Card style={{ marginTop: '24px', textAlign: 'center' }}>
          <Paragraph style={{ fontSize: '16px', marginBottom: '16px' }}>
            <strong>使用任何功能前需要登录</strong>
          </Paragraph>
          <Button
            type="primary"
            size="large"
            icon={<LoginOutlined />}
            onClick={() => router.push('/login')}
          >
            立即登录/注册
          </Button>
        </Card>
      )}
    </div>
  );
}
