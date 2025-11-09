/**
 * 协作Presence显示组件
 * 艹，这个组件必须实时显示在线用户，还要显示光标位置！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Badge,
  Tooltip,
  Card,
  List,
  Space,
  Typography,
  Button,
  Drawer,
  Timeline,
  Tag,
  Popover,
  FloatButton,
  Modal,
  Form,
  Input,
  Select,
  Divider
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  CameraOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { CollaborativeUser, VersionSnapshot } from '@/lib/collaboration/pipeline-collab';

const { Text, Title } = Typography;
const { Option } = Select;

interface CollaborationPresenceProps {
  onlineUsers: CollaborativeUser[];
  currentUser: CollaborativeUser | null;
  isConnected: boolean;
  snapshots: VersionSnapshot[];
  onRollback?: (snapshotId: string) => void;
  onCreateSnapshot?: (description: string) => void;
  onViewHistory?: () => void;
}

// 用户光标组件
const UserCursor: React.FC<{
  user: CollaborativeUser;
  isSelected?: boolean;
}> = ({ user, isSelected = false }) => {
  if (!user.cursor) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: user.cursor.x || 0,
        top: user.cursor.y || 0,
        pointerEvents: 'none',
        zIndex: 1000,
        transition: 'all 0.2s ease'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          backgroundColor: user.color,
          color: 'white',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          border: isSelected ? '2px solid #1890ff' : 'none'
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            backgroundColor: 'white',
            borderRadius: '50%',
            animation: 'pulse 1.5s infinite'
          }}
        />
        <Text style={{ color: 'white', fontSize: 11 }}>
          {user.name}
        </Text>
        {user.cursor.selection && (
          <Text style={{ color: 'white', fontSize: 10, opacity: 0.8 }}>
            “{user.cursor.selection.substring(0, 20)}
            {user.cursor.selection.length > 20 ? '...' : ''}
            ”
          </Text>
        )}
      </div>
    </div>
  );
};

export const CollaborationPresence: React.FC<CollaborationPresenceProps> = ({
  onlineUsers,
  currentUser,
  isConnected,
  snapshots,
  onRollback,
  onCreateSnapshot,
  onViewHistory
}) => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [snapshotModalVisible, setSnapshotModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 状态统计
  const editingUsers = onlineUsers.filter(user => user.status === 'editing');
  const onlineCount = onlineUsers.length;

  // 创建快照
  const handleCreateSnapshot = async () => {
    try {
      const values = await form.validateFields();
      onCreateSnapshot?.(values.description);
      setSnapshotModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('创建快照失败:', error);
    }
  };

  // 回滚到快照
  const handleRollback = (snapshot: VersionSnapshot) => {
    Modal.confirm({
      title: '确认回滚',
      content: (
        <div>
          <p>确定要回滚到以下版本吗？</p>
          <div style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            marginTop: '8px'
          }}>
            <p><strong>版本:</strong> {snapshot.version}</p>
            <p><strong>描述:</strong> {snapshot.description}</p>
            <p><strong>创建者:</strong> {snapshot.userId}</p>
            <p><strong>时间:</strong> {new Date(snapshot.timestamp).toLocaleString()}</p>
            <p><strong>操作数:</strong> {snapshot.operations}</p>
          </div>
          <p style={{ color: '#ff4d4f', marginTop: '12px' }}>
            ⚠️ 当前未保存的更改将会丢失
          </p>
        </div>
      ),
      onOk: () => {
        onRollback?.(snapshot.id);
      }
    });
  };

  return (
    <>
      {/* 在线用户列表 */}
      <Card
        size="default"
        title={
          <Space>
            <TeamOutlined />
            <span>在线用户 ({onlineCount})</span>
            {editingUsers.length > 0 && (
              <Badge count={editingUsers.length} size="small">
                <EditOutlined style={{ color: '#52c41a' }} />
              </Badge>
            )}
          </Space>
        }
        extra={
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDrawerVisible(true)}
          />
        }
        style={{ marginBottom: 16 }}
      >
        <List
          size="small"
          dataSource={onlineUsers.slice(0, 3)} // 最多显示3个
          renderItem={(user) => (
            <List.Item>
              <Space>
                <Badge
                  status={user.status === 'editing' ? 'processing' : 'success'}
                  dot={user.status === 'editing'}
                >
                  <Avatar
                    size="small"
                    style={{ backgroundColor: user.color }}
                    icon={<UserOutlined />}
                  />
                </Badge>
                <div>
                  <Text strong style={{ fontSize: 12 }}>
                    {user.name}
                    {user.status === 'editing' && (
                      <Text type="secondary" style={{ marginLeft: 4 }}>
                        正在编辑
                      </Text>
                    )}
                  </Text>
                  {user.cursor?.nodeId && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      节点: {user.cursor.nodeId}
                    </Text>
                  )}
                </div>
              </Space>
            </List.Item>
          )}
        />
        {onlineUsers.length > 3 && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              还有 {onlineUsers.length - 3} 位用户...
            </Text>
          </div>
        )}
      </Card>

      {/* 协作状态指示器 */}
      <Card
        size="small"
        title={
          <Space>
            <Badge
              status={isConnected ? 'success' : 'error'}
              text={isConnected ? '协作已连接' : '协作断开'}
            />
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="创建快照">
              <Button
                type="text"
                size="small"
                icon={<CameraOutlined />}
                onClick={() => setSnapshotModalVisible(true)}
              />
            </Tooltip>
            <Tooltip title="查看历史">
              <Button
                type="text"
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => setHistoryModalVisible(true)}
              />
            </Tooltip>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar
              size="small"
              style={{ backgroundColor: currentUser.color }}
              icon={<UserOutlined />}
            />
            <div>
              <Text strong style={{ fontSize: 12 }}>{currentUser.name}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                ID: {currentUser.id}
              </Text>
            </div>
          </div>
        )}
      </Card>

      {/* 用户详情抽屉 */}
      <Drawer
        title={
          <Space>
            <TeamOutlined />
            <span>协作详情</span>
          </Space>
        }
        placement="right"
        size="default"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={320}
      >
        <Title level={5}>在线用户 ({onlineCount})</Title>
        <List
          dataSource={onlineUsers}
          renderItem={(user) => (
            <List.Item>
              <Space>
                <Badge
                  status={user.status === 'editing' ? 'processing' : 'success'}
                  dot={user.status === 'editing'}
                >
                  <Avatar
                    style={{ backgroundColor: user.color }}
                    icon={<UserOutlined />}
                  />
                </Badge>
                <div style={{ flex: 1 }}>
                  <Text strong>{user.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {user.status === 'editing' ? (
                      <>
                        正在编辑
                        {user.cursor?.nodeId && (
                          <> · 节点 {user.cursor.nodeId}</>
                        )}
                      </>
                    ) : (
                      '在线'
                    )}
                  </Text>
                </div>
              </Space>
            </List.Item>
          )}
        />

        <Divider />

        <Title level={5}>统计信息</Title>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ textAlign: 'center', padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
              {onlineCount}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>在线总数</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
              {editingUsers.length}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>正在编辑</div>
          </div>
        </div>
      </Drawer>

      {/* 创建快照Modal */}
      <Modal
        title="创建快照"
        open={snapshotModalVisible}
        onCancel={() => setSnapshotModalVisible(false)}
        onOk={handleCreateSnapshot}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="快照描述"
            name="description"
            rules={[{ required: true, message: '请输入快照描述' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="描述这个快照的用途，例如：完成基础流程搭建"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 历史记录Modal */}
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            <span>版本历史</span>
          </Space>
        }
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={600}
      >
        <Timeline style={{ maxHeight: 400, overflowY: 'auto' }}>
          {snapshots.map((snapshot) => (
            <Timeline.Item
              key={snapshot.id}
              dot={<CameraOutlined style={{ color: '#1890ff' }} />}
            >
              <div>
                <div style={{ marginBottom: 4 }}>
                  <Text strong>{snapshot.description}</Text>
                  <Tag style={{ marginLeft: 8 }} color="blue">
                    v{snapshot.version}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  <Space direction="vertical" size={0}>
                    <span>创建者: {snapshot.userId}</span>
                    <span>时间: {new Date(snapshot.timestamp).toLocaleString()}</span>
                    <span>操作数: {snapshot.operations}</span>
                  </Space>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    onClick={() => handleRollback(snapshot)}
                  >
                    回滚到此版本
                  </Button>
                </div>
              </div>
            </Timeline.Item>
          ))}
          {snapshots.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <HistoryOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <p>暂无快照记录</p>
            </div>
          )}
        </Timeline>
      </Modal>

      {/* 添加动画样式 */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default CollaborationPresence;
