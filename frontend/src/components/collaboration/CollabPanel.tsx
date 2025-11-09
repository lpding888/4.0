'use client';

/**
 * 团队协作面板组件
 * 艹！这个组件支持评论、@提醒、表情、附件、任务分配！
 *
 * @author 老王
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Tabs,
  Input,
  Button,
  Space,
  Avatar,
  Typography,
  Tag,
  Upload,
  Mentions,
  Popover,
  Select,
  message,
  Timeline,
  Badge,
  Tooltip,
  Divider,
} from 'antd';
import {
  CommentOutlined,
  SendOutlined,
  SmileOutlined,
  PaperClipOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

/**
 * 评论
 */
export interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  mentions?: string[]; // @的用户ID列表
  attachments?: Array<{
    name: string;
    url: string;
    size: number;
  }>;
  created_at: number;
  updated_at?: number;
}

/**
 * 任务分配
 */
export interface Assignment {
  id: string;
  assignee_id: string;
  assignee_name: string;
  assignee_avatar?: string;
  assigner_id: string;
  assigner_name: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  due_date?: number;
  created_at: number;
  updated_at?: number;
}

/**
 * 审批
 */
export interface Approval {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_avatar?: string;
  approvers: Array<{
    user_id: string;
    user_name: string;
    status: 'pending' | 'approved' | 'rejected';
    comment?: string;
    updated_at?: number;
  }>;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  updated_at?: number;
}

/**
 * 协作面板Props
 */
export interface CollabPanelProps {
  visible: boolean;
  onClose: () => void;
  resourceType: 'template' | 'product' | 'prompt' | 'pipeline';
  resourceId: string;
  resourceName?: string;
}

/**
 * 常用表情
 */
const EMOJIS = ['👍', '👎', '❤️', '😄', '😮', '😢', '🎉', '💡', '🔥', '✨', '⚡', '💯'];

/**
 * 团队成员Mock数据（实际应该从API获取）
 */
const TEAM_MEMBERS = [
  { id: 'user-001', name: '张三', avatar: undefined },
  { id: 'user-002', name: '李四', avatar: undefined },
  { id: 'user-003', name: '王五', avatar: undefined },
  { id: 'user-004', name: '赵六', avatar: undefined },
];

/**
 * 协作面板组件
 */
export const CollabPanel: React.FC<CollabPanelProps> = ({
  visible,
  onClose,
  resourceType,
  resourceId,
  resourceName,
}) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'assignments' | 'approvals'>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [commentText, setCommentText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const commentInputRef = useRef<any>(null);

  /**
   * 加载数据
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const [commentsRes, assignmentsRes, approvalsRes] = await Promise.all([
        fetch(`/api/collab/comments?resource_type=${resourceType}&resource_id=${resourceId}`),
        fetch(`/api/collab/assignments?resource_type=${resourceType}&resource_id=${resourceId}`),
        fetch(`/api/collab/approvals?resource_type=${resourceType}&resource_id=${resourceId}`),
      ]);

      if (commentsRes.ok) {
        const data = await commentsRes.json();
        setComments(data.comments || []);
      }

      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(data.assignments || []);
      }

      if (approvalsRes.ok) {
        const data = await approvalsRes.json();
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('[CollabPanel] 加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, resourceType, resourceId]);

  /**
   * 发送评论
   */
  const handleSendComment = async () => {
    if (!commentText.trim()) {
      message.warning('请输入评论内容');
      return;
    }

    try {
      const response = await fetch('/api/collab/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          content: commentText,
          mentions,
          attachments: attachments.map((file) => ({
            name: file.name,
            url: file.url || '',
            size: file.size || 0,
          })),
        }),
      });

      if (!response.ok) throw new Error('发送失败');

      message.success('评论已发送');
      setCommentText('');
      setMentions([]);
      setAttachments([]);
      loadData();
    } catch (error: any) {
      message.error(`发送失败: ${error.message}`);
    }
  };

  /**
   * 插入表情
   */
  const handleInsertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    commentInputRef.current?.focus();
  };

  /**
   * 创建任务分配
   */
  const handleCreateAssignment = async (assigneeId: string, title: string) => {
    try {
      const response = await fetch('/api/collab/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          assignee_id: assigneeId,
          title,
        }),
      });

      if (!response.ok) throw new Error('分配失败');

      message.success('任务已分配');
      loadData();
    } catch (error: any) {
      message.error(`分配失败: ${error.message}`);
    }
  };

  /**
   * 更新任务状态
   */
  const handleUpdateAssignment = async (assignmentId: string, status: Assignment['status']) => {
    try {
      const response = await fetch(`/api/collab/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('更新失败');

      message.success('状态已更新');
      loadData();
    } catch (error: any) {
      message.error(`更新失败: ${error.message}`);
    }
  };

  /**
   * 未读数量
   */
  const getUnreadCounts = () => ({
    comments: comments.length,
    assignments: assignments.filter((a) => a.status === 'pending').length,
    approvals: approvals.filter((a) => a.status === 'pending').length,
  });

  const unreadCounts = getUnreadCounts();

  return (
    <Drawer
      title={
        <Space>
          <CommentOutlined />
          <span>协作</span>
          {resourceName && <Text type="secondary">- {resourceName}</Text>}
        </Space>
      }
      placement="right"
      width={480}
      open={visible}
      onClose={onClose}
      destroyOnClose
    >
      <Tabs activeKey={activeTab} onChange={(key: any) => setActiveTab(key)}>
        {/* 评论 */}
        <TabPane
          tab={
            <Badge count={unreadCounts.comments} offset={[10, 0]}>
              <Space>
                <CommentOutlined />
                评论
              </Space>
            </Badge>
          }
          key="comments"
        >
          <div style={{ marginBottom: 16 }}>
            {/* 评论输入 */}
            <Mentions
              ref={commentInputRef}
              value={commentText}
              onChange={(value) => setCommentText(value)}
              placeholder="输入评论，使用 @ 提醒团队成员"
              autoSize={{ minRows: 3, maxRows: 6 }}
              onSelect={(option) => {
                if (option.value) {
                  setMentions((prev) => [...prev, option.value as string]);
                }
              }}
              style={{ marginBottom: 8 }}
              options={TEAM_MEMBERS.map((member) => ({
                value: member.id,
                label: member.name,
              }))}
            />

            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Popover
                  content={
                    <div style={{ width: 240 }}>
                      <Space wrap>
                        {EMOJIS.map((emoji) => (
                          <Button
                            key={emoji}
                            type="text"
                            size="small"
                            onClick={() => handleInsertEmoji(emoji)}
                            style={{ fontSize: 20 }}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </Space>
                    </div>
                  }
                  trigger="click"
                >
                  <Button icon={<SmileOutlined />} size="small">
                    表情
                  </Button>
                </Popover>

                <Upload
                  fileList={attachments}
                  onChange={({ fileList }) => setAttachments(fileList)}
                  beforeUpload={() => false}
                  maxCount={5}
                >
                  <Button icon={<PaperClipOutlined />} size="small">
                    附件
                  </Button>
                </Upload>
              </Space>

              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendComment}
                disabled={!commentText.trim()}
              >
                发送
              </Button>
            </Space>
          </div>

          <Divider />

          {/* 评论列表 */}
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">暂无评论</Text>
              </div>
            ) : (
              <Timeline>
                {comments.map((comment) => (
                  <Timeline.Item key={comment.id}>
                    <div>
                      <Space>
                        <Avatar size="small">{comment.user_name[0]}</Avatar>
                        <Text strong>{comment.user_name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(comment.created_at).fromNow()}
                        </Text>
                      </Space>

                      <Paragraph style={{ marginTop: 8, marginBottom: 8 }}>
                        {comment.content}
                      </Paragraph>

                      {comment.mentions && comment.mentions.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {comment.mentions.map((userId) => {
                            const user = TEAM_MEMBERS.find((m) => m.id === userId);
                            return user ? (
                              <Tag key={userId} color="blue">
                                @{user.name}
                              </Tag>
                            ) : null;
                          })}
                        </div>
                      )}

                      {comment.attachments && comment.attachments.length > 0 && (
                        <div>
                          {comment.attachments.map((file, index) => (
                            <Tag key={index} icon={<PaperClipOutlined />}>
                              {file.name}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </div>
        </TabPane>

        {/* 任务分配 */}
        <TabPane
          tab={
            <Badge count={unreadCounts.assignments} offset={[10, 0]}>
              <Space>
                <UserAddOutlined />
                分配
              </Space>
            </Badge>
          }
          key="assignments"
        >
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {assignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">暂无任务分配</Text>
              </div>
            ) : (
              <Timeline>
                {assignments.map((assignment) => (
                  <Timeline.Item
                    key={assignment.id}
                    dot={
                      assignment.status === 'completed' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : assignment.status === 'cancelled' ? (
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      ) : (
                        <ClockCircleOutlined style={{ color: '#1890ff' }} />
                      )
                    }
                  >
                    <div>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong>{assignment.title}</Text>
                          <Tag
                            color={
                              assignment.status === 'completed'
                                ? 'success'
                                : assignment.status === 'cancelled'
                                ? 'error'
                                : assignment.status === 'in_progress'
                                ? 'processing'
                                : 'default'
                            }
                          >
                            {assignment.status}
                          </Tag>
                        </div>

                        <Space>
                          <Avatar size="small">{assignment.assignee_name[0]}</Avatar>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            分配给: {assignment.assignee_name}
                          </Text>
                        </Space>

                        <Text type="secondary" style={{ fontSize: 12 }}>
                          创建时间: {dayjs(assignment.created_at).format('YYYY-MM-DD HH:mm')}
                        </Text>

                        {assignment.status === 'pending' && (
                          <Space size="small" style={{ marginTop: 8 }}>
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => handleUpdateAssignment(assignment.id, 'in_progress')}
                            >
                              开始
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleUpdateAssignment(assignment.id, 'cancelled')}
                            >
                              取消
                            </Button>
                          </Space>
                        )}

                        {assignment.status === 'in_progress' && (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => handleUpdateAssignment(assignment.id, 'completed')}
                          >
                            完成
                          </Button>
                        )}
                      </Space>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </div>
        </TabPane>

        {/* 审批 */}
        <TabPane
          tab={
            <Badge count={unreadCounts.approvals} offset={[10, 0]}>
              <Space>
                <FileTextOutlined />
                审批
              </Space>
            </Badge>
          }
          key="approvals"
        >
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {approvals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">暂无审批</Text>
              </div>
            ) : (
              <Timeline>
                {approvals.map((approval) => (
                  <Timeline.Item key={approval.id}>
                    <div>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong>{approval.title}</Text>
                          <Tag
                            color={
                              approval.status === 'approved'
                                ? 'success'
                                : approval.status === 'rejected'
                                ? 'error'
                                : 'warning'
                            }
                          >
                            {approval.status}
                          </Tag>
                        </div>

                        <Space>
                          <Avatar size="small">{approval.requester_name[0]}</Avatar>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            申请人: {approval.requester_name}
                          </Text>
                        </Space>

                        <Divider style={{ margin: '8px 0' }} />

                        <Text type="secondary" style={{ fontSize: 12 }}>
                          审批人:
                        </Text>
                        {approval.approvers.map((approver) => (
                          <div key={approver.user_id} style={{ paddingLeft: 16 }}>
                            <Space>
                              <Avatar size="small">{approver.user_name[0]}</Avatar>
                              <Text>{approver.user_name}</Text>
                              <Tag
                                color={
                                  approver.status === 'approved'
                                    ? 'success'
                                    : approver.status === 'rejected'
                                    ? 'error'
                                    : 'default'
                                }
                              >
                                {approver.status}
                              </Tag>
                            </Space>
                          </div>
                        ))}
                      </Space>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </div>
        </TabPane>
      </Tabs>
    </Drawer>
  );
};
