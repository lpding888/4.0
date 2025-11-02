'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Button,
  Switch,
  Tag,
  Modal,
  message,
  Space
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Feature } from '@/types';

const { confirm } = Modal;

/**
 * 功能卡片管理列表页
 *
 * 艹，管理员专用页面，必须有权限控制！
 */
export default function AdminFeaturesPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<Feature[]>([]);

  // 获取所有功能卡片（包括禁用的）
  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const response: any = await api.admin.getFeatures();

      if (response.success && response.features) {
        setFeatures(response.features);
      }
    } catch (error: any) {
      message.error('获取功能列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // TODO: 检查用户是否为admin
    // if (user.role !== 'admin') {
    //   message.error('无权限访问');
    //   router.push('/workspace');
    //   return;
    // }

    fetchFeatures();
  }, [user, router]);

  // 切换启用状态
  const handleToggle = async (featureId: string, currentEnabled: boolean, quotaCost: number) => {
    // 艹，如果配额为0且要开启，必须二次确认！
    if (quotaCost === 0 && !currentEnabled) {
      confirm({
        title: '警告',
        icon: <ExclamationCircleOutlined />,
        content: '该功能配额为0，开启后可能导致滥用和成本失控。确定要开启吗？',
        okText: '确定开启',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          await toggleFeatureAPI(featureId, !currentEnabled);
        }
      });
    } else {
      await toggleFeatureAPI(featureId, !currentEnabled);
    }
  };

  const toggleFeatureAPI = async (featureId: string, enabled: boolean) => {
    try {
      await api.admin.toggleFeature(featureId, { is_enabled: enabled });
      message.success(enabled ? '已启用' : '已禁用');
      fetchFeatures(); // 刷新列表
    } catch (error: any) {
      message.error('操作失败');
    }
  };

  // 删除功能
  const handleDelete = (featureId: string, displayName: string) => {
    confirm({
      title: '确认删除',
      content: `确定要删除功能 "${displayName}" 吗？`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.admin.deleteFeature(featureId);
          message.success('删除成功');
          fetchFeatures();
        } catch (error: any) {
          message.error('删除失败');
        }
      }
    });
  };

  // 表格列定义
  const columns = [
    {
      title: 'Feature ID',
      dataIndex: 'feature_id',
      key: 'feature_id',
      width: 180
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => <Tag color="blue">{category}</Tag>
    },
    {
      title: '是否启用',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 100,
      render: (enabled: boolean, record: Feature) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggle(record.feature_id, enabled, record.quota_cost)}
        />
      )
    },
    {
      title: '所需套餐',
      dataIndex: 'plan_required',
      key: 'plan_required',
      width: 100,
      render: (plan: string) => {
        const colorMap: Record<string, string> = {
          free: 'green',
          basic: 'blue',
          pro: 'gold',
          enterprise: 'purple'
        };
        return <Tag color={colorMap[plan] || 'default'}>{plan}</Tag>;
      }
    },
    {
      title: '访问范围',
      dataIndex: 'access_scope',
      key: 'access_scope',
      width: 100,
      render: (scope: string) => (
        <Tag color={scope === 'whitelist' ? 'orange' : 'green'}>
          {scope === 'plan' ? '套餐' : '白名单'}
        </Tag>
      )
    },
    {
      title: '配额消耗',
      dataIndex: 'quota_cost',
      key: 'quota_cost',
      width: 100,
      render: (cost: number) => (
        <span className={cost === 0 ? 'text-red-500 font-bold' : ''}>
          {cost} 次
        </span>
      )
    },
    {
      title: '限流策略',
      dataIndex: 'rate_limit_policy',
      key: 'rate_limit_policy',
      width: 120,
      render: (policy: string | null) => policy || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Feature) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => router.push(`/admin/features/${record.feature_id}/edit`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.feature_id, record.display_name)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-light text-white">功能卡片管理</h1>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => router.push('/admin/features/new')}
            className="border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-400/30"
          >
            新增功能卡片
          </Button>
        </div>

        {/* 表格 */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-6">
          <Table
            columns={columns}
            dataSource={features}
            rowKey="feature_id"
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 20,
              showTotal: (total) => `共 ${total} 条`
            }}
          />
        </div>
      </div>
    </div>
  );
}
