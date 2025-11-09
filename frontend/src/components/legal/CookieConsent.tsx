'use client';

/**
 * Cookie同意组件
 * 艹！GDPR合规必备，Cookie同意横幅！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import { Button, Space, Typography } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';

const { Text, Link } = Typography;

/**
 * Cookie同意组件
 */
export const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 检查用户是否已同意
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  /**
   * 接受所有Cookie
   */
  const handleAcceptAll = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    }));
    setVisible(false);
  };

  /**
   * 只接受必要Cookie
   */
  const handleAcceptNecessary = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        padding: '20px',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <Space direction="vertical" size={8}>
            <div>
              <InfoCircleOutlined style={{ color: '#fff', fontSize: 20, marginRight: 8 }} />
              <Text strong style={{ color: '#fff', fontSize: 16 }}>
                我们使用Cookie
              </Text>
            </div>

            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 14 }}>
              我们使用Cookie来改善您的体验、分析网站使用情况和提供个性化内容。
              继续使用本网站即表示您同意我们的{' '}
              <Link href="/legal/privacy" style={{ color: '#1890ff' }}>
                隐私政策
              </Link>
              {' '}和Cookie政策。
            </Text>
          </Space>
        </div>

        <Space>
          <Button
            icon={<SettingOutlined />}
            onClick={handleAcceptNecessary}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
            }}
          >
            只接受必要
          </Button>

          <Button
            type="primary"
            onClick={handleAcceptAll}
            style={{
              background: '#1890ff',
              border: 'none',
            }}
          >
            接受所有Cookie
          </Button>
        </Space>
      </div>
    </div>
  );
};
