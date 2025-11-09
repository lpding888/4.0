/**
 * PAGE-P0-USERS-005 用户管理页面
 * 艹，用户管理必须做好，权限控制不能马虎！
 *
 * 功能清单：
 * 1. 用户列表展示与搜索
 * 2. 用户状态管理（启用/禁用）
 * 3. 角色权限分配
 * 4. 批量操作支持
 * 5. 用户详情查看
 * 6. 新增/编辑用户
 * 7. 密码重置
 * 8. 登录历史查看
 *
 * @author 老王
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Badge,
  Avatar,
  Tooltip,
  Popconfirm,
  message,
  Row,
  Col,
  Statistic,
  Card,
  List,
  Tabs,
  DatePicker,
  Divider
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  KeyOutlined,
  HistoryOutlined,
  ExportOutlined,
  ImportOutlined,
  TeamOutlined,
  CrownOutlined,
  SafetyOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  LockOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import DataTablePro, { DataTableColumn } from '@/components/base/DataTablePro';
import BaseCard from '@/components/base/BaseCard';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 用户状态枚举
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

// 用户角色枚举
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  GUEST = 'guest'
}

// 用户类型定义
export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  realName?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  loginCount: number;
  department?: string;
  permissions: string[];
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
    skills?: string[];
  };
}

// 用户表单数据
export interface UserFormData {
  username: string;
  email: string;
  phone?: string;
  realName?: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  permissions: string[];
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
  };
}

// 登录历史记录
export interface LoginHistory {
  id: string;
  userId: string;
  loginTime: string;
  logoutTime?: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  status: 'success' | 'failed';
  failureReason?: string;
}

// 模拟用户数据
const mockUsers: User[] = [
  {
    id: 'user_001',
    username: 'admin',
    email: 'admin@example.com',
    phone: '13800138000',
    realName: '系统管理员',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    lastLoginAt: '2025-11-03T09:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2025-11-03T08:30:00Z',
    loginCount: 1250,
    department: '技术部',
    permissions: ['*'],
    profile: {
      bio: '系统超级管理员',
      location: '北京',
      website: 'https://example.com',
      skills: ['系统管理', '开发', '运维']
    }
  },
  {
    id: 'user_002',
    username: 'manager001',
    email: 'manager@example.com',
    phone: '13800138001',
    realName: '张经理',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager001',
    role: UserRole.MANAGER,
    status: UserStatus.ACTIVE,
    lastLoginAt: '2025-11-03T08:30:00Z',
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2025-11-02T16:20:00Z',
    loginCount: 890,
    department: '产品部',
    permissions: ['user:read', 'user:write', 'content:manage'],
    profile: {
      bio: '产品经理',
      location: '上海',
      skills: ['产品管理', '需求分析', '项目管理']
    }
  },
  {
    id: 'user_003',
    username: 'developer001',
    email: 'dev@example.com',
    phone: '13800138002',
    realName: '李开发',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer001',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    lastLoginAt: '2025-11-03T07:45:00Z',
    createdAt: '2024-03-20T00:00:00Z',
    updatedAt: '2025-11-01T14:10:00Z',
    loginCount: 650,
    department: '技术部',
    permissions: ['content:read', 'content:write'],
    profile: {
      bio: '前端开发工程师',
      location: '深圳',
      skills: ['React', 'TypeScript', 'Node.js']
    }
  },
  {
    id: 'user_004',
    username: 'guest001',
    email: 'guest@example.com',
    realName: '王访客',
    role: UserRole.GUEST,
    status: UserStatus.PENDING,
    lastLoginAt: '2025-11-02T18:20:00Z',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-02T18:20:00Z',
    loginCount: 3,
    department: '访客',
    permissions: ['content:read'],
    profile: {
      bio: '临时访客用户',
      location: '未知'
    }
  },
  {
    id: 'user_005',
    username: 'suspended_user',
    email: 'suspended@example.com',
    realName: '赵用户',
    role: UserRole.USER,
    status: UserStatus.SUSPENDED,
    lastLoginAt: '2025-10-25T14:30:00Z',
    createdAt: '2024-05-10T00:00:00Z',
    updatedAt: '2025-10-28T09:15:00Z',
    loginCount: 120,
    department: '市场部',
    permissions: ['content:read'],
    profile: {
      bio: '已被暂停的用户',
      location: '广州',
      skills: ['市场营销']
    }
  }
];

// 模拟登录历史数据
const mockLoginHistory: LoginHistory[] = [
  {
    id: 'login_001',
    userId: 'user_001',
    loginTime: '2025-11-03T09:00:00Z',
    logoutTime: '2025-11-03T09:30:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    location: '北京',
    status: 'success'
  },
  {
    id: 'login_002',
    userId: 'user_002',
    loginTime: '2025-11-03T08:30:00Z',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    location: '上海',
    status: 'success'
  },
  {
    id: 'login_003',
    userId: 'user_004',
    loginTime: '2025-11-02T18:20:00Z',
    ipAddress: '192.168.1.104',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
    location: '未知',
    status: 'success'
  },
  {
    id: 'login_004',
    userId: 'unknown',
    loginTime: '2025-11-02T17:45:00Z',
    ipAddress: '192.168.1.200',
    userAgent: 'Mozilla/5.0 (compatible; Bot/1.0)',
    location: '未知',
    status: 'failed',
    failureReason: '密码错误'
  }
];

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginHistoryVisible, setLoginHistoryVisible] = useState(false);
  const [form] = Form.useForm();
  const [searchValue, setSearchValue] = useState('');

  // 角色配置
  const roleConfig = {
    [UserRole.SUPER_ADMIN]: { label: '超级管理员', color: 'red', icon: <CrownOutlined /> },
    [UserRole.ADMIN]: { label: '管理员', color: 'orange', icon: <SafetyOutlined /> },
    [UserRole.MANAGER]: { label: '经理', color: 'blue', icon: <TeamOutlined /> },
    [UserRole.USER]: { label: '普通用户', color: 'green', icon: <UserOutlined /> },
    [UserRole.GUEST]: { label: '访客', color: 'default', icon: <UserOutlined /> }
  };

  // 状态配置
  const statusConfig = {
    [UserStatus.ACTIVE]: { label: '正常', color: 'success' },
    [UserStatus.INACTIVE]: { label: '未激活', color: 'default' },
    [UserStatus.SUSPENDED]: { label: '已暂停', color: 'error' },
    [UserStatus.PENDING]: { label: '待审核', color: 'warning' }
  };

  // 获取统计数据
  const getStatistics = () => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE).length;
    const suspendedUsers = users.filter(u => u.status === UserStatus.SUSPENDED).length;
    const pendingUsers = users.filter(u => u.status === UserStatus.PENDING).length;
    const adminUsers = users.filter(u => u.role === UserRole.SUPER_ADMIN || u.role === UserRole.ADMIN).length;

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingUsers,
      adminUsers,
      onlineUsers: Math.floor(activeUsers * 0.7) // 模拟在线用户数
    };
  };

  // 刷新数据
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('数据已刷新');
    }, 1000);
  };

  // 搜索用户
  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    if (!searchValue) return true;
    const searchLower = searchValue.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.realName?.toLowerCase().includes(searchLower) ||
      user.department?.toLowerCase().includes(searchLower)
    );
  });

  // 新增用户
  const handleAddUser = () => {
    setCurrentUser(null);
    form.resetFields();
    setEditModalVisible(true);
  };

  // 编辑用户
  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    form.setFieldsValue({
      ...user,
      password: '' // 密码不回填
    });
    setEditModalVisible(true);
  };

  // 保存用户
  const handleSaveUser = async (values: UserFormData) => {
    try {
      if (currentUser) {
        // 更新用户
        const updatedUsers = users.map(u =>
          u.id === currentUser.id
            ? { ...u, ...values, updatedAt: new Date().toISOString() }
            : u
        );
        setUsers(updatedUsers);
        message.success('用户信息已更新');
      } else {
        // 新增用户
        const newUser: User = {
          id: `user_${Date.now()}`,
          ...values,
          loginCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          permissions: values.permissions || []
        };
        setUsers([...users, newUser]);
        message.success('用户创建成功');
      }
      setEditModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  // 删除用户
  const handleDeleteUser = (userId: string) => {
    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    message.success('用户已删除');
  };

  // 批量操作
  const handleBatchOperation = (operation: string) => {
    if (selectedUsers.length === 0) {
      message.warning('请选择要操作的用户');
      return;
    }

    Modal.confirm({
      title: `确认${operation}`,
      content: `确定要${operation}选中的 ${selectedUsers.length} 个用户吗？`,
      onOk: () => {
        if (operation === '删除') {
          const updatedUsers = users.filter(u => !selectedUsers.includes(u.id));
          setUsers(updatedUsers);
          message.success(`已删除 ${selectedUsers.length} 个用户`);
        } else if (operation === '启用') {
          const updatedUsers = users.map(u =>
            selectedUsers.includes(u.id) ? { ...u, status: UserStatus.ACTIVE } : u
          );
          setUsers(updatedUsers);
          message.success(`已启用 ${selectedUsers.length} 个用户`);
        } else if (operation === '禁用') {
          const updatedUsers = users.map(u =>
            selectedUsers.includes(u.id) ? { ...u, status: UserStatus.SUSPENDED } : u
          );
          setUsers(updatedUsers);
          message.success(`已禁用 ${selectedUsers.length} 个用户`);
        }
        setSelectedUsers([]);
      }
    });
  };

  // 重置密码
  const handleResetPassword = (user: User) => {
    Modal.confirm({
      title: '重置密码',
      content: `确定要重置用户 ${user.username} 的密码吗？`,
      onOk: () => {
        message.success('密码重置成功，新密码已发送到用户邮箱');
      }
    });
  };

  // 查看用户详情
  const handleViewDetail = (user: User) => {
    setCurrentUser(user);
    setDetailModalVisible(true);
  };

  // 查看登录历史
  const handleViewLoginHistory = (user: User) => {
    setCurrentUser(user);
    setLoginHistoryVisible(true);
  };

  // 切换用户状态
  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
    const updatedUsers = users.map(u =>
      u.id === user.id ? { ...u, status: newStatus, updatedAt: new Date().toISOString() } : u
    );
    setUsers(updatedUsers);
    message.success(`用户状态已更新为${statusConfig[newStatus].label}`);
  };

  const stats = getStatistics();

  // 表格列定义
  const columns: DataTableColumn<User>[] = [
    {
      key: 'user',
      title: '用户信息',
      dataIndex: 'username',
      width: 280,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            size="large"
            src={record.avatar}
            icon={<UserOutlined />}
          />
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>
              {record.realName || record.username}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              @{record.username}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {record.email}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: (role: UserRole) => {
        const config = roleConfig[role];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
      filterable: true,
      filters: Object.entries(roleConfig).map(([key, config]) => ({
        text: config.label,
        value: key
      }))
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: UserStatus) => {
        const config = statusConfig[status];
        return <Badge status={config.color as any} text={config.label} />;
      },
      filterable: true,
      filters: Object.entries(statusConfig).map(([key, config]) => ({
        text: config.label,
        value: key
      }))
    },
    {
      key: 'department',
      title: '部门',
      dataIndex: 'department',
      width: 120,
      render: (department) => department || '-'
    },
    {
      key: 'lastLoginAt',
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 150,
      render: (time) => time ? dayjs(time).format('MM-DD HH:mm') : '从未登录',
      sorter: true
    },
    {
      key: 'loginCount',
      title: '登录次数',
      dataIndex: 'loginCount',
      width: 100,
      sorter: true
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<UserOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          <Tooltip title="重置密码">
            <Button
              type="text"
              size="small"
              icon={<KeyOutlined />}
              onClick={() => handleResetPassword(record)}
            />
          </Tooltip>
          <Tooltip title="登录历史">
            <Button
              type="text"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleViewLoginHistory(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === UserStatus.ACTIVE ? '禁用' : '启用'}>
            <Switch
              size="small"
              checked={record.status === UserStatus.ACTIVE}
              onChange={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个用户吗？"
              onConfirm={() => handleDeleteUser(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* 页面标题 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>用户管理</Title>
          <Text type="secondary">管理系统用户、角色权限和账户状态</Text>
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '总用户数', value: stats.totalUsers, color: '#1890ff' }
            ]}>
              <TeamOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '活跃用户', value: stats.activeUsers, color: '#52c41a' }
            ]}>
              <UserOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '在线用户', value: stats.onlineUsers, color: '#13c2c2' }
            ]}>
              <CrownOutlined style={{ fontSize: 24, color: '#13c2c2' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '管理员', value: stats.adminUsers, color: '#faad14' }
            ]}>
              <SafetyOutlined style={{ fontSize: 24, color: '#faad14' }} />
            </BaseCard>
          </Col>
        </Row>

        {/* 主要内容区域 */}
        <BaseCard
          title="用户列表"
          extra={
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
                新增用户
              </Button>
              <Button icon={<ImportOutlined />}>
                批量导入
              </Button>
              <Button icon={<ExportOutlined />}>
                导出数据
              </Button>
            </Space>
          }
          actions={[
            {
              key: 'batch-enable',
              label: '批量启用',
              onClick: () => handleBatchOperation('启用')
            },
            {
              key: 'batch-disable',
              label: '批量禁用',
              onClick: () => handleBatchOperation('禁用')
            },
            {
              key: 'batch-delete',
              label: '批量删除',
              onClick: () => handleBatchOperation('删除'),
              danger: true
            }
          ]}
          onRefresh={handleRefresh}
        >
          <DataTablePro
            columns={columns}
            dataSource={filteredUsers}
            loading={loading}
            rowSelection={{
              selectedRowKeys: selectedUsers,
              onChange: setSelectedUsers,
              getCheckboxProps: (record) => ({
                disabled: record.role === UserRole.SUPER_ADMIN // 超级管理员不能被选中
              })
            }}
            search={{
              placeholder: '搜索用户名、邮箱、姓名或部门',
              allowClear: true
            }}
            onSearch={handleSearch}
            pagination={{
              current: 1,
              pageSize: 20,
              total: filteredUsers.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: true
            }}
            actions={{
              refresh: true,
              export: true,
              columnSetting: true
            }}
          />
        </BaseCard>

        {/* 新增/编辑用户模态框 */}
        <Modal
          title={currentUser ? '编辑用户' : '新增用户'}
          open={editModalVisible}
          onCancel={() => setEditModalVisible(false)}
          footer={null}
          width={800}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveUser}
            initialValues={{
              role: UserRole.USER,
              status: UserStatus.ACTIVE,
              permissions: []
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="username"
                  label="用户名"
                  rules={[
                    { required: true, message: '请输入用户名' },
                    { min: 3, max: 20, message: '用户名长度为3-20个字符' },
                    { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
                  ]}
                >
                  <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="realName"
                  label="真实姓名"
                  rules={[{ required: true, message: '请输入真实姓名' }]}
                >
                  <Input placeholder="请输入真实姓名" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="email"
                  label="邮箱地址"
                  rules={[
                    { required: true, message: '请输入邮箱地址' },
                    { type: 'email', message: '请输入有效的邮箱地址' }
                  ]}
                >
                  <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="phone"
                  label="手机号码"
                  rules={[
                    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="请输入手机号码" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="password"
                  label={currentUser ? '新密码（留空则不修改）' : '密码'}
                  rules={currentUser ? [] : [
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码至少6个字符' }
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="department"
                  label="部门"
                >
                  <Input placeholder="请输入部门" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="role"
                  label="用户角色"
                  rules={[{ required: true, message: '请选择用户角色' }]}
                >
                  <Select placeholder="请选择用户角色">
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <Select.Option key={key} value={key}>
                        <Tag color={config.color} icon={config.icon}>
                          {config.label}
                        </Tag>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="status"
                  label="用户状态"
                  rules={[{ required: true, message: '请选择用户状态' }]}
                >
                  <Select placeholder="请选择用户状态">
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <Select.Option key={key} value={key}>
                        <Badge status={config.color as any} text={config.label} />
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="profile.bio"
              label="个人简介"
            >
              <Input.TextArea rows={3} placeholder="请输入个人简介" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setEditModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  {currentUser ? '更新' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 用户详情模态框 */}
        <Modal
          title="用户详情"
          open={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          footer={[
            <Button key="edit" type="primary" onClick={() => {
              setDetailModalVisible(false);
              if (currentUser) handleEditUser(currentUser);
            }}>
              编辑用户
            </Button>,
            <Button key="close" onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={900}
        >
          {currentUser && (
            <div>
              <Row gutter={24}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Avatar size={80} src={currentUser.avatar} icon={<UserOutlined />} />
                    <Title level={4} style={{ marginTop: 16, marginBottom: 8 }}>
                      {currentUser.realName || currentUser.username}
                    </Title>
                    <Text type="secondary">@{currentUser.username}</Text>
                    <div style={{ marginTop: 16 }}>
                      <Tag color={roleConfig[currentUser.role].color} icon={roleConfig[currentUser.role].icon}>
                        {roleConfig[currentUser.role].label}
                      </Tag>
                      <Badge
                        status={statusConfig[currentUser.status].color as any}
                        text={statusConfig[currentUser.status].label}
                        style={{ marginLeft: 8 }}
                      />
                    </div>
                  </div>
                </Col>
                <Col span={16}>
                  <Tabs defaultActiveKey="basic">
                    <TabPane tab="基本信息" key="basic">
                      <Row gutter={16}>
                        <Col span={12}>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>用户ID：</Text>
                            <Text copyable>{currentUser.id}</Text>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>邮箱地址：</Text>
                            <Text>{currentUser.email}</Text>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>手机号码：</Text>
                            <Text>{currentUser.phone || '-'}</Text>
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>所属部门：</Text>
                            <Text>{currentUser.department || '-'}</Text>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>注册时间：</Text>
                            <Text>{dayjs(currentUser.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <Text strong>最后登录：</Text>
                            <Text>
                              {currentUser.lastLoginAt
                                ? dayjs(currentUser.lastLoginAt).format('YYYY-MM-DD HH:mm:ss')
                                : '从未登录'}
                            </Text>
                          </div>
                        </Col>
                      </Row>
                      {currentUser.profile?.bio && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>个人简介：</Text>
                          <Typography.Paragraph>{currentUser.profile.bio}</Typography.Paragraph>
                        </div>
                      )}
                    </TabPane>
                    <TabPane tab="统计信息" key="stats">
                      <Row gutter={16}>
                        <Col span={8}>
                          <Statistic
                            title="登录次数"
                            value={currentUser.loginCount}
                            prefix={<HistoryOutlined />}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="账户状态"
                            value={statusConfig[currentUser.status].label}
                            valueStyle={{ color: currentUser.status === UserStatus.ACTIVE ? '#3f8600' : '#cf1322' }}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="权限数量"
                            value={currentUser.permissions.length}
                            prefix={<SafetyOutlined />}
                          />
                        </Col>
                      </Row>
                    </TabPane>
                    <TabPane tab="权限列表" key="permissions">
                      {currentUser.permissions.length > 0 ? (
                        <div>
                          {currentUser.permissions.includes('*') ? (
                            <Tag color="red">超级管理员权限</Tag>
                          ) : (
                            <Space wrap>
                              {currentUser.permissions.map(permission => (
                                <Tag key={permission} color="blue">
                                  {permission}
                                </Tag>
                              ))}
                            </Space>
                          )}
                        </div>
                      ) : (
                        <Text type="secondary">暂无特殊权限</Text>
                      )}
                    </TabPane>
                  </Tabs>
                </Col>
              </Row>
            </div>
          )}
        </Modal>

        {/* 登录历史模态框 */}
        <Modal
          title={`登录历史 - ${currentUser?.realName || currentUser?.username}`}
          open={loginHistoryVisible}
          onCancel={() => setLoginHistoryVisible(false)}
          footer={[
            <Button key="close" onClick={() => setLoginHistoryVisible(false)}>
              关闭
            </Button>
          ]}
          width={1000}
        >
          <List
            dataSource={mockLoginHistory.filter(h => currentUser && h.userId === currentUser.id)}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      style={{
                        backgroundColor: item.status === 'success' ? '#52c41a' : '#ff4d4f'
                      }}
                      icon={item.status === 'success' ? <UserOutlined /> : <LockOutlined />}
                    />
                  }
                  title={
                    <div>
                      <Text strong>{dayjs(item.loginTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
                      {item.status === 'failed' && (
                        <Tag color="red" style={{ marginLeft: 8 }}>
                          登录失败 - {item.failureReason}
                        </Tag>
                      )}
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">IP地址：</Text>
                        <Text>{item.ipAddress}</Text>
                        {item.location && (
                          <>
                            <Text type="secondary" style={{ marginLeft: 16 }}>地点：</Text>
                            <Text>{item.location}</Text>
                          </>
                        )}
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.userAgent}
                        </Text>
                      </div>
                      {item.logoutTime && (
                        <div>
                          <Text type="secondary">登出时间：</Text>
                          <Text>{dayjs(item.logoutTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Modal>
      </div>
    </div>
  );
}