/**
 * 订单详情Modal组件
 * 艹！这个Modal展示订单的完整详细信息！
 *
 * @author 老王
 */

import React from 'react';
import { Modal, Descriptions, Tag, Button, Space, Divider, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Order, OrderStatus } from '@/app/account/billing/page';

const { Text, Title } = Typography;

/**
 * OrderDetailModal Props
 */
interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onDownloadInvoice?: (orderId: string) => void;
  downloadingInvoice?: boolean;
}

/**
 * 订单状态配置
 */
const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: '待支付',
    color: 'orange',
    icon: <ClockCircleOutlined />,
  },
  paid: {
    label: '已支付',
    color: 'green',
    icon: <CheckCircleOutlined />,
  },
  failed: {
    label: '支付失败',
    color: 'red',
    icon: <CloseCircleOutlined />,
  },
  refunded: {
    label: '已退款',
    color: 'default',
    icon: <CloseCircleOutlined />,
  },
};

/**
 * 订单详情Modal
 */
export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  open,
  onClose,
  onDownloadInvoice,
  downloadingInvoice = false,
}) => {
  if (!order) return null;

  const statusConfig = ORDER_STATUS_CONFIG[order.status];

  return (
    <Modal
      title={
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            订单详情
          </Text>
          <Tag icon={statusConfig.icon} color={statusConfig.color}>
            {statusConfig.label}
          </Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          {order.has_invoice && onDownloadInvoice && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={downloadingInvoice}
              onClick={() => onDownloadInvoice(order.order_id)}
            >
              下载发票
            </Button>
          )}
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
      width={700}
    >
      {/* 订单基本信息 */}
      <Descriptions title="订单信息" bordered column={2} size="small">
        <Descriptions.Item label="订单编号" span={2}>
          <Text copyable style={{ fontFamily: 'monospace' }}>
            {order.order_id}
          </Text>
        </Descriptions.Item>

        <Descriptions.Item label="套餐类型">{order.plan_name}</Descriptions.Item>

        <Descriptions.Item label="订单金额">
          <Text strong style={{ color: '#ff4d4f', fontSize: 18 }}>
            ¥{order.amount.toFixed(2)}
          </Text>
        </Descriptions.Item>

        <Descriptions.Item label="订单状态" span={2}>
          <Tag icon={statusConfig.icon} color={statusConfig.color}>
            {statusConfig.label}
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="创建时间">
          {dayjs(order.created_at).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>

        <Descriptions.Item label="支付时间">
          {order.paid_at ? dayjs(order.paid_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>

        {order.payment_method && (
          <Descriptions.Item label="支付方式" span={2}>
            {order.payment_method}
          </Descriptions.Item>
        )}

        <Descriptions.Item label="是否有发票" span={2}>
          {order.has_invoice ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              已开具
            </Tag>
          ) : (
            <Tag color="default">未开具</Tag>
          )}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* 套餐权益说明 */}
      <div>
        <Title level={5} style={{ marginBottom: 16 }}>
          套餐权益
        </Title>
        {order.plan_type === 'free' && (
          <ul style={{ paddingLeft: 20 }}>
            <li>每月 100 次生成额度</li>
            <li>基础 AI 模型</li>
            <li>标准图片质量</li>
            <li>社区支持</li>
          </ul>
        )}
        {order.plan_type === 'pro' && (
          <ul style={{ paddingLeft: 20 }}>
            <li>每月 1000 次生成额度</li>
            <li>高级 AI 模型</li>
            <li>高清图片质量</li>
            <li>优先客服支持</li>
            <li>完整模板库</li>
            <li>无水印导出</li>
            <li>批量处理功能</li>
          </ul>
        )}
        {order.plan_type === 'enterprise' && (
          <ul style={{ paddingLeft: 20 }}>
            <li>每月 10000 次生成额度</li>
            <li>顶级 AI 模型</li>
            <li>超清图片质量</li>
            <li>专属客服支持</li>
            <li>定制模板开发</li>
            <li>API 接口访问</li>
            <li>团队协作功能</li>
            <li>数据统计分析</li>
            <li>私有化部署</li>
          </ul>
        )}
      </div>

      <Divider />

      {/* 温馨提示 */}
      <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <strong>温馨提示：</strong>
          <br />
          1. 订单支付成功后，配额将立即生效
          <br />
          2. 发票通常在支付成功后24小时内自动生成
          <br />
          3. 如有疑问，请联系客服：400-XXX-XXXX
        </Text>
      </div>
    </Modal>
  );
};
