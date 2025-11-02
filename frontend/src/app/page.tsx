'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Row, Col, Spin, Button, Space, Tag } from 'antd';
import {
  LoginOutlined,
  CrownOutlined,
  ThunderboltFilled,
  CheckCircleFilled,
  RocketOutlined,
  ScissorOutlined,
  UserOutlined,
  VideoCameraOutlined,
  BgColorsOutlined,
  EditOutlined,
  CompressOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  FireOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * HomePage - 首页
 *
 * 艹！突出服装服饰AI处理一站式服务，展示所有核心功能
 */
export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);

  // 完整的功能列表（展示所有规划的功能）
  const allFeatures = [
    // 基础处理
    {
      id: 'basic_clean',
      name: '智能抠图',
      icon: <ScissorOutlined />,
      category: '基础处理',
      description: '一键去除背景，生成透明底或纯色底商品图',
      features: ['自动识别主体', '边缘精细处理', '支持批量处理'],
      quota: '1配额/张',
      status: 'available',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      id: 'background_change',
      name: '背景替换',
      icon: <BgColorsOutlined />,
      category: '基础处理',
      description: '智能更换图片背景，提供多种场景模板',
      features: ['场景模板库', '自定义背景', '自动适配光影'],
      quota: '2配额/张',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      id: 'image_enhancement',
      name: '图片增强',
      icon: <EditOutlined />,
      category: '基础处理',
      description: '智能优化图片质量，提升清晰度和色彩',
      features: ['智能降噪', '色彩增强', '锐化处理'],
      quota: '1配额/张',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
      id: 'image_compress',
      name: '智能压缩',
      icon: <CompressOutlined />,
      category: '基础处理',
      description: '无损压缩图片，减小文件大小不损画质',
      features: ['智能压缩算法', '保持画质', '批量处理'],
      quota: '免费',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    },
    {
      id: 'detail_page',
      name: '一键详情页',
      icon: <FileImageOutlined />,
      category: '基础处理',
      description: '自动生成电商详情页，智能排版布局专业美观',
      features: ['智能排版', '多模板选择', '一键生成'],
      quota: '5配额/页',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      hot: true
    },

    // AI模特
    {
      id: 'model_pose12',
      name: 'AI模特上身',
      icon: <UserOutlined />,
      category: 'AI模特',
      description: '智能生成12张AI模特试穿效果，多角度展示',
      features: ['12种姿势', '男女模特可选', '真实上身效果'],
      quota: '10配额/次',
      status: 'available',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      hot: true
    },
    {
      id: 'qianzi_engine',
      name: '千姿引擎',
      icon: <ThunderboltFilled />,
      category: 'AI模特',
      description: '一张图秒变多姿态，千姿百态，电商、模特、服装专用',
      features: ['一键多姿态', '千姿百态效果', '电商展示优化'],
      quota: '8配额/次',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      hot: true
    },
    {
      id: 'model_custom',
      name: '自定义模特',
      icon: <UserOutlined />,
      category: 'AI模特',
      description: '上传模特照片，生成定制化试穿效果',
      features: ['自定义模特', '保持人物特征', '高度还原'],
      quota: '15配额/次',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)'
    },
    {
      id: 'batch_model',
      name: '批量模特生成',
      icon: <ThunderboltOutlined />,
      category: 'AI模特',
      description: '批量处理多款服装，快速生成模特图',
      features: ['批量上传', '统一风格', '高效处理'],
      quota: '8配额/张',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    },
    {
      id: 'shoe_model',
      name: '鞋模上脚',
      icon: <ThunderboltFilled />,
      category: 'AI模特',
      description: '一键让鞋子自然"穿"在模特脚上，光影融合完美无瑕',
      features: ['全自动化流程', '智能涂抹识别', '光影完美融合'],
      quota: '6配额/次',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      hot: true
    },

    // 视频生成
    {
      id: 'video_generate',
      name: '服装展示视频',
      icon: <VideoCameraOutlined />,
      category: '视频生成',
      description: '自动生成服装展示短视频，多角度动态展示',
      features: ['360度展示', '动态效果', '自动配乐'],
      quota: '20配额/个',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      hot: true
    },
    {
      id: 'model_video',
      name: '模特走秀视频',
      icon: <VideoCameraOutlined />,
      category: '视频生成',
      description: 'AI生成模特走秀视频，专业T台效果',
      features: ['T台走秀', '专业灯光', 'HD画质'],
      quota: '30配额/个',
      status: 'coming',
      gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    }
  ];

  const handleFeatureClick = (featureId: string, status: string) => {
    if (status === 'coming') {
      return; // 敬请期待的功能不可点击
    }

    if (!user) {
      router.push('/login');
    } else {
      router.push(`/task/create/${featureId}`);
    }
  };

  // 按类别分组
  const groupedFeatures: Record<string, typeof allFeatures> = {};
  allFeatures.forEach(feature => {
    if (!groupedFeatures[feature.category]) {
      groupedFeatures[feature.category] = [];
    }
    groupedFeatures[feature.category].push(feature);
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      paddingBottom: '80px'
    }}>
      {/* Hero区域 */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #FEF3C7 100%)',
        borderBottom: '1px solid var(--border-primary)',
        padding: '100px 24px 80px 24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 装饰性光晕 */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(234, 179, 8, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-5%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(217, 119, 6, 0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          {/* 品牌标识 */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '28px',
            padding: '8px 20px',
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            borderRadius: '24px',
            border: '2px solid #FCD34D',
            boxShadow: '0 4px 12px rgba(252, 211, 77, 0.3)'
          }}>
            <RocketOutlined style={{ fontSize: '18px', color: '#D97706' }} />
            <span style={{
              color: '#92400E',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.5px'
            }}>
              服装服饰 AI 处理一站式平台
            </span>
          </div>

          {/* 主标题 */}
          <h1 style={{
            fontSize: '64px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1F2937 0%, #92400E 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '24px',
            letterSpacing: '-2px',
            lineHeight: '1.1'
          }}>
            专业服装AI处理平台
          </h1>

          {/* 副标题 */}
          <p style={{
            fontSize: '20px',
            color: '#374151',
            marginBottom: '32px',
            lineHeight: '1.8',
            fontWeight: 500,
            maxWidth: '800px',
            margin: '0 auto 32px auto'
          }}>
            <strong style={{ color: '#92400E' }}>一站式解决</strong>
            所有服装图片处理需求
            <br />
            从基础修图到AI换装，从静态图片到动态视频
          </p>

          {/* 核心功能亮点 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '32px',
            marginBottom: '48px',
            flexWrap: 'wrap'
          }}>
            {[
              { icon: '🎨', text: '智能抠图去背景' },
              { icon: '👗', text: 'AI模特上身展示' },
              { icon: '🎬', text: '视频自动生成' },
              { icon: '⚡', text: '批量快速处理' }
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '16px',
                  border: '1.5px solid #E5E7EB',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <span style={{ fontSize: '24px' }}>{item.icon}</span>
                <span style={{
                  fontSize: '15px',
                  fontWeight: 500,
                  color: '#1F2937'
                }}>
                  {item.text}
                </span>
                <CheckCircleFilled style={{ fontSize: '16px', color: '#10B981' }} />
              </div>
            ))}
          </div>

          {/* CTA按钮 */}
          {user ? (
            <Button
              type="primary"
              size="large"
              icon={<CrownOutlined />}
              onClick={() => router.push('/workspace')}
              style={{
                height: '56px',
                fontSize: '17px',
                padding: '0 56px',
                fontWeight: 600,
                borderRadius: '28px',
                boxShadow: '0 8px 24px rgba(146, 64, 14, 0.35)'
              }}
            >
              进入工作台
            </Button>
          ) : (
            <Space direction="vertical" size={20}>
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                onClick={() => router.push('/login')}
                style={{
                  height: '56px',
                  fontSize: '17px',
                  padding: '0 56px',
                  fontWeight: 600,
                  borderRadius: '28px',
                  boxShadow: '0 8px 24px rgba(146, 64, 14, 0.35)'
                }}
              >
                免费开始使用
              </Button>
              <div style={{
                color: '#6B7280',
                fontSize: '14px'
              }}>
                <span>↓</span> 浏览下方所有功能，注册即可使用
              </div>
            </Space>
          )}

          {/* 数据展示 */}
          <div style={{
            marginTop: '56px',
            display: 'flex',
            justifyContent: 'center',
            gap: '56px',
            flexWrap: 'wrap'
          }}>
            {[
              { value: '10万+', label: '服装商家' },
              { value: '500万+', label: '图片处理' },
              { value: '99.9%', label: '客户满意度' }
            ].map((stat, idx) => (
              <div key={idx} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#92400E',
                  marginBottom: '8px'
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  fontWeight: 500
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 功能展示区域 */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '80px 24px'
      }}>
        {/* 区域标题 */}
        <div style={{
          textAlign: 'center',
          marginBottom: '64px'
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#1F2937',
            marginBottom: '16px'
          }}>
            全方位服装处理解决方案
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            涵盖基础修图、AI模特、视频生成等12大核心功能
          </p>
        </div>

        {/* 功能卡片 */}
        {Object.keys(groupedFeatures).map((category, catIdx) => (
          <div
            key={category}
            style={{
              marginBottom: catIdx === Object.keys(groupedFeatures).length - 1 ? 0 : '72px'
            }}
          >
            {/* 分类标题 */}
            <div style={{
              marginBottom: '40px',
              textAlign: 'center'
            }}>
              <h3 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#1F2937',
                marginBottom: '12px'
              }}>
                {category}
              </h3>
              <div style={{
                width: '60px',
                height: '4px',
                background: 'linear-gradient(90deg, #92400E, #D97706)',
                borderRadius: '2px',
                margin: '0 auto'
              }} />
            </div>

            {/* 功能卡片网格 */}
            <Row gutter={[24, 24]}>
              {groupedFeatures[category].map((feature) => (
                <Col key={feature.id} xs={24} sm={12} lg={8} xl={6}>
                  <Card
                    hoverable={feature.status === 'available'}
                    onClick={() => handleFeatureClick(feature.id, feature.status)}
                    style={{
                      height: '100%',
                      borderRadius: '16px',
                      border: '2px solid #F3F4F6',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      cursor: feature.status === 'available' ? 'pointer' : 'default',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease'
                    }}
                    bodyStyle={{ padding: '24px' }}
                  >
                    {/* 渐变背景装饰 */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '6px',
                      background: feature.gradient
                    }} />

                    {/* 状态标签 */}
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      display: 'flex',
                      gap: '8px'
                    }}>
                      {feature.hot && (
                        <Tag color="red" icon={<FireOutlined />}>
                          热门
                        </Tag>
                      )}
                      {feature.status === 'coming' && (
                        <Tag color="default" icon={<ClockCircleOutlined />}>
                          即将上线
                        </Tag>
                      )}
                    </div>

                    {/* 图标 */}
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '14px',
                      background: feature.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px',
                      fontSize: '28px',
                      color: '#FFF'
                    }}>
                      {feature.icon}
                    </div>

                    {/* 标题 */}
                    <h4 style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#1F2937',
                      marginBottom: '12px'
                    }}>
                      {feature.name}
                    </h4>

                    {/* 描述 */}
                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      lineHeight: '1.6',
                      marginBottom: '16px',
                      minHeight: '42px'
                    }}>
                      {feature.description}
                    </p>

                    {/* 功能特点 */}
                    <div style={{
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {feature.features.map((feat, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '13px',
                            color: '#9CA3AF',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <CheckCircleFilled style={{ fontSize: '12px', color: '#10B981' }} />
                          {feat}
                        </div>
                      ))}
                    </div>

                    {/* 配额信息 */}
                    <div style={{
                      paddingTop: '16px',
                      borderTop: '1px solid #F3F4F6',
                      fontSize: '13px',
                      color: '#92400E',
                      fontWeight: 500
                    }}>
                      💰 {feature.quota}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
      </div>

      {/* 底部CTA */}
      {!user && (
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <Card
            style={{
              textAlign: 'center',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              border: '2px solid #F3F4F6',
              padding: '48px 32px',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FEFCE8 100%)'
            }}
          >
            <ThunderboltFilled style={{
              fontSize: '48px',
              color: '#F59E0B',
              marginBottom: '24px'
            }} />

            <div style={{ marginBottom: '32px' }}>
              <h3 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#1F2937',
                marginBottom: '16px'
              }}>
                立即体验服装AI一站式处理
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6B7280',
                marginBottom: 0,
                lineHeight: '1.7'
              }}>
                注册即可免费使用基础功能，快速提升店铺转化率
              </p>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<LoginOutlined />}
              onClick={() => router.push('/login')}
              style={{
                height: '56px',
                fontSize: '17px',
                padding: '0 56px',
                fontWeight: 600,
                borderRadius: '28px',
                boxShadow: '0 8px 24px rgba(146, 64, 14, 0.35)'
              }}
            >
              免费注册开始使用
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
