'use client';

/**
 * 订阅中心页面
 * 艹！这个页面展示所有套餐，让用户选择升级！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import { Row, Col, Alert, Spin, Typography, Space, message, Modal } from 'antd';
import { CrownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { PlanCard, DEFAULT_PLANS, PlanConfig } from '@/components/billing/PlanCard';
import { useQuota } from '@/store/quota';
import type { PlanType } from '@/store/quota';

const { Title, Paragraph, Text } = Typography;

/**
 * 订阅中心页面
 */
export default function MembershipPlansPage() {
  // 配额状态
  const { quota, isLoading: quotaLoading, fetchQuota } = useQuota();

  // 套餐列表
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  // 购买加载状态
  const [purchasingPlan, setPurchasingPlan] = useState<PlanType | null>(null);

  /**
   * 加载套餐列表
   */
  const loadPlans = async () => {
    setPlansLoading(true);

    try {
      const response = await fetch('/api/billing/plans', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取套餐失败: ${response.status}`);
      }

      const data = await response.json();

      // 标记当前套餐
      const plansWithCurrent = (data.plans || DEFAULT_PLANS).map((plan: PlanConfig) => ({
        ...plan,
        is_current: quota?.plan_type === plan.plan_type,
      }));

      setPlans(plansWithCurrent);
    } catch (error: any) {
      console.error('[订阅中心] 获取套餐失败:', error);
      message.error(error.message || '获取套餐失败');

      // 使用默认套餐（带当前标记）
      const plansWithCurrent = DEFAULT_PLANS.map((plan) => ({
        ...plan,
        is_current: quota?.plan_type === plan.plan_type,
      }));
      setPlans(plansWithCurrent);
    } finally {
      setPlansLoading(false);
    }
  };

  /**
   * 处理购买套餐
   */
  const handlePurchase = async (planType: PlanType) => {
    // 如果已经是当前套餐，不做任何处理
    if (quota?.plan_type === planType) {
      return;
    }

    // 如果是免费版，直接切换
    if (planType === 'free') {
      message.info('您已经在使用免费版了');
      return;
    }

    // 确认购买
    const planName = plans.find((p) => p.plan_type === planType)?.plan_name || planType;
    Modal.confirm({
      title: `确认购买 ${planName}？`,
      icon: <InfoCircleOutlined />,
      content: '购买后将立即生效，配额将会更新。',
      okText: '确认购买',
      cancelText: '取消',
      onOk: async () => {
        setPurchasingPlan(planType);

        try {
          // 调用后端购买接口
          const response = await fetch('/api/billing/purchase', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              plan_type: planType,
            }),
          });

          if (!response.ok) {
            throw new Error(`购买失败: ${response.status}`);
          }

          const data = await response.json();

          message.success(`购买成功！您已升级到 ${planName}`);

          // 重新加载配额和套餐
          await fetchQuota();
          await loadPlans();
        } catch (error: any) {
          console.error('[订阅中心] 购买失败:', error);
          message.error(error.message || '购买失败，请稍后重试');
        } finally {
          setPurchasingPlan(null);
        }
      },
    });
  };

  /**
   * 初始化
   */
  useEffect(() => {
    fetchQuota();
    loadPlans();
  }, []);

  return (
    <div style={{ padding: '40px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <CrownOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <Title level={2} style={{ marginBottom: 16 }}>
          选择适合您的套餐
        </Title>
        <Paragraph style={{ fontSize: 16, color: '#666', maxWidth: 600, margin: '0 auto' }}>
          灵活的定价方案，满足个人和企业的不同需求。所有套餐均支持按月订阅，随时升级或降级。
        </Paragraph>
      </div>

      {/* 当前配额提示 */}
      {quota && (
        <Alert
          message={
            <Space>
              <Text strong>当前套餐：{quota.plan_name}</Text>
              <Text>
                剩余配额：{quota.remaining_quota.toLocaleString()} /{' '}
                {quota.total_quota.toLocaleString()} 次
              </Text>
            </Space>
          }
          type="info"
          showIcon
          style={{ marginBottom: 32 }}
        />
      )}

      {/* 套餐卡片 */}
      <Spin spinning={plansLoading || quotaLoading}>
        <Row gutter={[24, 24]}>
          {plans.map((plan) => (
            <Col xs={24} sm={24} md={8} key={plan.plan_type}>
              <PlanCard
                plan={plan}
                onPurchase={handlePurchase}
                loading={purchasingPlan === plan.plan_type}
              />
            </Col>
          ))}
        </Row>
      </Spin>

      {/* 底部说明 */}
      <div style={{ marginTop: 48, textAlign: 'center' }}>
        <Paragraph style={{ color: '#999', fontSize: 14 }}>
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          配额每月自动重置，未使用的配额不累计到下月。企业版支持定制化需求，请联系客服。
        </Paragraph>
      </div>
    </div>
  );
}
