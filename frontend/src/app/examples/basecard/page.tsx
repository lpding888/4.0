/**
 * BaseCard 组件使用示例
 * 艹，这个示例必须展示所有功能，让用户知道怎么用！
 *
 * @author 老王
 */

'use client';

import React, { useState } from 'react';
import BaseCard, { BaseCardProps, BaseCardStats, BaseCardAction } from '@/components/base/BaseCard';
import {
  Button,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  Tag,
  Progress,
  Avatar,
  List,
  Statistic
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  FullscreenOutlined,
  DownloadOutlined,
  ShareAltOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function BaseCardExample() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // 示例统计数据
  const exampleStats: BaseCardStats[] = [
    {
      label: '总用户数',
      value: '12,345',
      color: '#1890ff',
      trend: { value: 12.5, direction: 'up' }
    },
    {
      label: '活跃率',
      value: '68.9%',
      color: '#52c41a',
      trend: { value: 3.2, direction: 'up' }
    },
    {
      label: '错误率',
      value: '0.8%',
      color: '#ff4d4f',
      trend: { value: 1.5, direction: 'down' }
    }
  ];

  // 示例操作按钮
  const exampleActions: BaseCardAction[] = [
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => console.log('编辑操作'),
      tooltip: '编辑此项目'
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      onClick: () => console.log('删除操作'),
      danger: true,
      tooltip: '删除此项目'
    }
  ];

  const handleRefresh = () => {
    setLoading(true);
    setError(false);
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleClearError = () => {
    setError(false);
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Title level={2}>BaseCard 组件示例</Title>
        <Paragraph>
          BaseCard 是一个功能丰富的基础卡片组件，支持多种主题、尺寸、操作和状态展示。
        </Paragraph>

        <Divider orientation="left">基础用法</Divider>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <BaseCard
              title="简单卡片"
              subtitle="基础用法示例"
              description="这是一个最简单的卡片示例，展示了基本的标题和内容。"
            >
              <Text>这是卡片的内容区域。</Text>
            </BaseCard>
          </Col>

          <Col span={8}>
            <BaseCard
              title="带统计的卡片"
              stats={exampleStats}
            >
              <Text>这个卡片展示了统计信息功能。</Text>
            </BaseCard>
          </Col>

          <Col span={8}>
            <BaseCard
              title="带操作的卡片"
              extra={
                <Space>
                  <Button type="primary" size="small">
                    主要操作
                  </Button>
                  <Button size="small">次要操作</Button>
                </Space>
              }
            >
              <Text>这个卡片展示了 extra 操作区域。</Text>
            </BaseCard>
          </Col>
        </Row>

        <Divider orientation="left">主题样式</Divider>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <BaseCard
              title="默认主题"
              theme="default"
              description="默认的卡片样式"
            >
              <Tag color="blue">Default</Tag>
            </BaseCard>
          </Col>

          <Col span={6}>
            <BaseCard
              title="主要主题"
              theme="primary"
              description="主要色调的卡片"
            >
              <Tag color="blue">Primary</Tag>
            </BaseCard>
          </Col>

          <Col span={6}>
            <BaseCard
              title="成功主题"
              theme="success"
              description="成功状态的卡片"
            >
              <Tag color="green">Success</Tag>
            </BaseCard>
          </Col>

          <Col span={6}>
            <BaseCard
              title="警告主题"
              theme="warning"
              description="警告状态的卡片"
            >
              <Tag color="orange">Warning</Tag>
            </BaseCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <BaseCard
              title="错误主题"
              theme="error"
              description="错误状态的卡片"
            >
              <Tag color="red">Error</Tag>
            </BaseCard>
          </Col>

          <Col span={12}>
            <BaseCard
              title="无边框卡片"
              bordered={false}
              shadow={true}
              description="没有边框但有阴影的卡片"
            >
              <Text>无边框设计，更加简洁。</Text>
            </BaseCard>
          </Col>
        </Row>

        <Divider orientation="left">尺寸变化</Divider>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <BaseCard
              title="小尺寸"
              size="small"
              description="适用于空间有限的场景"
              stats={[
                { label: '用户', value: '1.2K' },
                { label: '增长', value: '+12%' }
              ]}
            >
              <Space>
                <Avatar size="small" icon={<UserOutlined />} />
                <Text>小尺寸内容</Text>
              </Space>
            </BaseCard>
          </Col>

          <Col span={8}>
            <BaseCard
              title="中等尺寸"
              size="middle"
              description="默认尺寸，适用于大多数场景"
              stats={[
                { label: '用户', value: '12.3K' },
                { label: '增长', value: '+12.5%' }
              ]}
            >
              <Space>
                <Avatar icon={<UserOutlined />} />
                <Text>中等尺寸内容</Text>
              </Space>
            </BaseCard>
          </Col>

          <Col span={8}>
            <BaseCard
              title="大尺寸"
              size="large"
              description="适用于重要信息展示"
              stats={[
                { label: '用户', value: '123.4K' },
                { label: '增长', value: '+12.8%' }
              ]}
            >
              <Space size="large">
                <Avatar size="large" icon={<UserOutlined />} />
                <div>
                  <Text strong>大尺寸内容</Text>
                  <br />
                  <Text type="secondary">更多详细信息</Text>
                </div>
              </Space>
            </BaseCard>
          </Col>
        </Row>

        <Divider orientation="left">状态展示</Divider>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <BaseCard
              title="加载状态"
              loading={true}
              description="正在加载数据..."
            >
              <Text>内容加载中</Text>
            </BaseCard>
          </Col>

          <Col span={8}>
            <BaseCard
              title="错误状态"
              error="数据加载失败，请检查网络连接后重试。"
              onRefresh={handleClearError}
              description="错误处理示例"
            >
              <Text>正常内容</Text>
            </BaseCard>
          </Col>

          <Col span={8}>
            <BaseCard
              title="空状态"
              empty={
                <div style={{ padding: '40px 0' }}>
                  <UserOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                  <div>
                    <Text type="secondary">暂无数据</Text>
                  </div>
                  <Button type="primary" style={{ marginTop: 16 }}>
                    创建第一个项目
                  </Button>
                </div>
              }
              description="空数据状态展示"
            >
              <Text>正常内容</Text>
            </BaseCard>
          </Col>
        </Row>

        <Divider orientation="left">交互功能</Divider>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <BaseCard
              title="带操作按钮的卡片"
              subtitle="支持自定义操作"
              description="这个卡片展示了自定义操作按钮的功能"
              actions={exampleActions}
              onRefresh={handleRefresh}
              onSettings={() => console.log('设置')}
              onFullscreen={() => console.log('全屏')}
            >
              <div>
                <Paragraph>
                  这里是卡片的主要内容区域。您可以在操作栏中找到各种操作按钮。
                </Paragraph>
                <Space>
                  <Button onClick={handleRefresh}>手动刷新</Button>
                  <Button onClick={handleError}>模拟错误</Button>
                </Space>
              </div>
            </BaseCard>
          </Col>

          <Col span={12}>
            <BaseCard
              title="可展开卡片"
              subtitle="点击展开按钮查看更多"
              description="这个卡片支持展开和收起功能"
              showExpand={true}
              defaultExpanded={false}
              stats={exampleStats}
            >
              <div>
                <Title level={4}>展开后的内容</Title>
                <Paragraph>
                  这是展开后才显示的内容。您可以使用这个功能来管理复杂的信息展示。
                </Paragraph>
                <List
                  size="small"
                  dataSource={[
                    '功能特性 1：支持多种主题',
                    '功能特性 2：响应式设计',
                    '功能特性 3：丰富的配置选项'
                  ]}
                  renderItem={item => <List.Item>{item}</List.Item>}
                />
              </div>
            </BaseCard>
          </Col>
        </Row>

        <Divider orientation="left">复杂示例</Divider>
        <BaseCard
          title="项目管理面板"
          subtitle="综合功能展示"
          description="这是一个包含所有功能的复杂卡片示例"
          theme="primary"
          size="large"
          stats={[
            {
              label: '项目总数',
              value: '48',
              color: '#1890ff',
              trend: { value: 8.2, direction: 'up' }
            },
            {
              label: '完成率',
              value: '75.6%',
              color: '#52c41a',
              trend: { value: 5.3, direction: 'up' }
            },
            {
              label: '团队成员',
              value: '12',
              color: '#722ed1',
              trend: { value: 2, direction: 'up' }
            }
          ]}
          actions={[
            {
              key: 'export',
              label: '导出',
              icon: <DownloadOutlined />,
              onClick: () => console.log('导出数据'),
              tooltip: '导出项目数据'
            },
            {
              key: 'share',
              label: '分享',
              icon: <ShareAltOutlined />,
              onClick: () => console.log('分享项目'),
              tooltip: '分享项目链接'
            },
            ...exampleActions
          ]}
          onSettings={() => console.log('项目设置')}
          onFullscreen={() => console.log('全屏查看')}
          loading={loading}
          error={error ? '项目数据加载失败' : undefined}
          onRefresh={error ? handleClearError : handleRefresh}
        >
          <div>
            <Row gutter={[16, 16]}>
              <Col span={16}>
                <div>
                  <Title level={4}>项目概览</Title>
                  <Paragraph>
                    这是项目的详细信息区域，包含了项目的各种统计数据和操作选项。
                    您可以在这里查看项目的整体进展情况，并进行相关的操作。
                  </Paragraph>

                  <div style={{ marginBottom: 16 }}>
                    <Text strong>项目进度</Text>
                    <Progress percent={75.6} status="active" style={{ marginTop: 8 }} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <Text strong>最近活动</Text>
                    <List
                      size="small"
                      dataSource={[
                        { user: '张三', action: '完成了任务A', time: '2小时前' },
                        { user: '李四', action: '创建了任务B', time: '4小时前' },
                        { user: '王五', action: '更新了项目文档', time: '1天前' }
                      ]}
                      renderItem={item => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} />}
                            title={`${item.user} ${item.action}`}
                            description={item.time}
                          />
                        </List.Item>
                      )}
                    />
                  </div>
                </div>
              </Col>

              <Col span={8}>
                <div>
                  <Title level={4}>快速操作</Title>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button type="primary" block icon={<EditOutlined />}>
                      编辑项目
                    </Button>
                    <Button block icon={<UserOutlined />}>
                      管理成员
                    </Button>
                    <Button block icon={<SettingOutlined />}>
                      项目设置
                    </Button>
                    <Button block icon={<ShareAltOutlined />}>
                      分享项目
                    </Button>
                  </Space>
                </div>
              </Col>
            </Row>
          </div>
        </BaseCard>
      </div>
    </div>
  );
}
