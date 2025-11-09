'use client';

/**
 * 规则引擎管理页面
 * 艹！这个页面支持可视化规则编辑、JSON编辑、导入导出！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Tabs,
  Divider,
  Typography,
  Row,
  Col,
  Badge,
  Tooltip,
  Upload,
  Drawer,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ExportOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  NodeIndexOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { Rule, Trigger, Condition, Action, RuleStatus } from '@/lib/rules/types';
import { ruleEngine } from '@/lib/rules/engine';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

/**
 * 规则管理页面
 */
export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  const [form] = Form.useForm();
  const [stats, setStats] = useState({ total: 0, enabled: 0, event: 0, schedule: 0 });

  /**
   * 加载规则列表
   */
  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/rules');
      if (!response.ok) throw new Error('加载规则失败');

      const data = await response.json();
      setRules(data.rules || []);

      // 加载到引擎
      ruleEngine.loadRules(data.rules || []);

      // 更新统计
      const engineStats = ruleEngine.getStats();
      setStats({
        total: data.rules?.length || 0,
        enabled: engineStats.enabled_rules,
        event: engineStats.event_rules,
        schedule: engineStats.schedule_rules,
      });
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  /**
   * 创建新规则
   */
  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'draft',
      trigger: { type: 'event' },
      conditions: [],
      actions: [],
      priority: 0,
    });
    setEditorVisible(true);
  };

  /**
   * 编辑规则
   */
  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    form.setFieldsValue(rule);
    setEditorVisible(true);
  };

  /**
   * 保存规则
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const rule: Rule = {
        id: editingRule?.id || `rule-${Date.now()}`,
        ...values,
        created_at: editingRule?.created_at || Date.now(),
        updated_at: Date.now(),
        version: (editingRule?.version || 0) + 1,
      };

      const response = await fetch('/api/admin/rules', {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });

      if (!response.ok) throw new Error('保存失败');

      message.success(editingRule ? '规则已更新' : '规则已创建');
      setEditorVisible(false);
      loadRules();
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
    }
  };

  /**
   * 切换规则状态
   */
  const handleToggle = async (rule: Rule, enabled: boolean) => {
    try {
      const updatedRule = { ...rule, status: (enabled ? 'enabled' : 'disabled') as RuleStatus };

      const response = await fetch('/api/admin/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRule),
      });

      if (!response.ok) throw new Error('更新失败');

      message.success(enabled ? '规则已启用' : '规则已禁用');
      loadRules();
    } catch (error: any) {
      message.error(`更新失败: ${error.message}`);
    }
  };

  /**
   * 删除规则
   */
  const handleDelete = (ruleId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条规则吗？',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/rules/${ruleId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('删除失败');

          message.success('规则已删除');
          loadRules();
        } catch (error: any) {
          message.error(`删除失败: ${error.message}`);
        }
      },
    });
  };

  /**
   * 测试规则
   */
  const handleTest = async (rule: Rule) => {
    Modal.confirm({
      title: '测试规则',
      content: (
        <div>
          <Paragraph>将手动触发此规则进行测试，使用模拟的上下文数据。</Paragraph>
          <Paragraph type="secondary">确定要继续吗？</Paragraph>
        </div>
      ),
      onOk: async () => {
        try {
          // 模拟触发事件
          const testContext = {
            user_id: 'test-user',
            tenant_id: 'test-tenant',
            event_data: { test: true },
          };

          const results = await ruleEngine.triggerEvent(
            (rule.trigger as any).event_name || 'test.event',
            testContext.event_data,
            testContext
          );

          if (results && results.length > 0 && results[0]?.conditions_met) {
            message.success(`规则测试成功！执行了 ${results[0]?.actions_executed} 个动作`);
          } else {
            message.warning('规则条件不满足');
          }
        } catch (error: any) {
          message.error(`测试失败: ${error.message}`);
        }
      },
    });
  };

  /**
   * 导出规则
   */
  const handleExport = () => {
    const json = JSON.stringify(rules, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rules-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('规则已导出');
  };

  /**
   * 导入规则
   */
  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        const importedRules: Rule[] = JSON.parse(json);

        if (!Array.isArray(importedRules)) {
          throw new Error('无效的规则格式');
        }

        const response = await fetch('/api/admin/rules/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: importedRules }),
        });

        if (!response.ok) throw new Error('导入失败');

        message.success(`成功导入 ${importedRules.length} 条规则`);
        loadRules();
      } catch (error: any) {
        message.error(`导入失败: ${error.message}`);
      }
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  /**
   * 规则列表列定义
   */
  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, rule: Rule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {rule.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {rule.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '触发器',
      dataIndex: 'trigger',
      key: 'trigger',
      render: (trigger: Trigger) => {
        if (trigger.type === 'event') {
          return (
            <Space>
              <ThunderboltOutlined style={{ color: '#1890ff' }} />
              <Text>{(trigger as any).event_name}</Text>
            </Space>
          );
        } else {
          return (
            <Space>
              <ClockCircleOutlined style={{ color: '#52c41a' }} />
              <Text>{(trigger as any).cron}</Text>
            </Space>
          );
        }
      },
    },
    {
      title: '条件/动作',
      key: 'stats',
      render: (_: any, rule: Rule) => (
        <Space>
          <Badge count={rule.conditions.length} showZero style={{ backgroundColor: '#722ed1' }} />
          <Text type="secondary">条件</Text>
          <Divider type="vertical" />
          <Badge count={rule.actions.length} showZero style={{ backgroundColor: '#13c2c2' }} />
          <Text type="secondary">动作</Text>
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: number) => priority || 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: RuleStatus) => {
        const config = {
          enabled: { color: 'success', text: '已启用' },
          disabled: { color: 'default', text: '已禁用' },
          draft: { color: 'warning', text: '草稿' },
        };
        return <Tag color={config[status].color}>{config[status].text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_: any, rule: Rule) => (
        <Space size="small">
          <Switch
            size="small"
            checked={rule.status === 'enabled'}
            onChange={(checked) => handleToggle(rule, checked)}
          />
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(rule)} />
          </Tooltip>
          <Tooltip title="测试">
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleTest(rule)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                const copy = { ...rule, id: `rule-${Date.now()}`, name: `${rule.name} (副本)` };
                setEditingRule(copy);
                form.setFieldsValue(copy);
                setEditorVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(rule.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题和统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Row gutter={16}>
              <Col xs={24} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">总规则数</Text>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                    {stats.total}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">已启用</Text>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a', marginTop: 8 }}>
                    {stats.enabled}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">事件触发</Text>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#722ed1', marginTop: 8 }}>
                    {stats.event}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={6}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">定时触发</Text>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#13c2c2', marginTop: 8 }}>
                    {stats.schedule}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 规则列表 */}
      <Card
        title={
          <Space>
            <NodeIndexOutlined />
            <span>规则列表</span>
          </Space>
        }
        extra={
          <Space>
            <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
              <Button icon={<ImportOutlined />}>导入</Button>
            </Upload>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建规则
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rules}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>

      {/* 规则编辑器抽屉 */}
      <Drawer
        title={editingRule ? '编辑规则' : '创建规则'}
        open={editorVisible}
        onClose={() => setEditorVisible(false)}
        width={720}
        extra={
          <Space>
            <Button onClick={() => setEditorVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSave}>
              保存
            </Button>
          </Space>
        }
      >
        <Tabs activeKey={editorMode} onChange={(key) => setEditorMode(key as any)}>
          <TabPane
            tab={
              <Space>
                <NodeIndexOutlined />
                可视化编辑
              </Space>
            }
            key="visual"
          >
            <Form form={form} layout="vertical">
              <Form.Item label="规则名称" name="name" rules={[{ required: true, message: '请输入规则名称' }]}>
                <Input placeholder="例如：低配额用户自动发通知" />
              </Form.Item>

              <Form.Item label="描述" name="description">
                <TextArea rows={2} placeholder="规则的详细说明" />
              </Form.Item>

              <Form.Item label="状态" name="status" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="enabled">启用</Select.Option>
                  <Select.Option value="disabled">禁用</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="优先级" name="priority">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100，数字越大优先级越高" />
              </Form.Item>

              <Divider>触发器</Divider>

              <Form.Item label="触发类型" name={['trigger', 'type']} rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="event">事件触发</Select.Option>
                  <Select.Option value="schedule">定时触发</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.trigger?.type !== currentValues.trigger?.type
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue(['trigger', 'type']) === 'event' ? (
                    <>
                      <Form.Item label="事件名称" name={['trigger', 'event_name']} rules={[{ required: true }]}>
                        <Input placeholder="例如：user.login" />
                      </Form.Item>
                      <Form.Item label="防抖延迟(ms)" name={['trigger', 'debounce']}>
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="可选，防止重复触发" />
                      </Form.Item>
                      <Form.Item label="节流延迟(ms)" name={['trigger', 'throttle']}>
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="可选，限制触发频率" />
                      </Form.Item>
                    </>
                  ) : (
                    <Form.Item label="Cron表达式" name={['trigger', 'cron']} rules={[{ required: true }]}>
                      <Input placeholder="例如：0 0 * * * (每天0点)" />
                    </Form.Item>
                  )
                }
              </Form.Item>

              <Divider>条件和动作</Divider>

              <Paragraph type="secondary">
                条件和动作的详细配置请切换到 JSON 编辑模式
              </Paragraph>
            </Form>
          </TabPane>

          <TabPane
            tab={
              <Space>
                <CodeOutlined />
                JSON 编辑
              </Space>
            }
            key="json"
          >
            <Form form={form} layout="vertical">
              <Form.Item label="规则 JSON">
                <TextArea
                  rows={20}
                  value={JSON.stringify(form.getFieldsValue(), null, 2)}
                  onChange={(e) => {
                    try {
                      const json = JSON.parse(e.target.value);
                      form.setFieldsValue(json);
                    } catch (error) {
                      // 忽略JSON解析错误
                    }
                  }}
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Drawer>
    </div>
  );
}
