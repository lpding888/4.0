/**
 * 节点配置面板（Inspector）
 * 艹！用于配置选中节点的参数，集成VarPicker和Monaco编辑器！
 */

'use client';

import React, { useMemo, useState } from 'react';
import { Card, Form, Input, Select, Button, Space, message, Divider } from 'antd';
import { VarPicker, buildDefaultVarTree, validateVarReferences } from '@/components/flow/VarPicker';
import type { VarNode } from '@/components/flow/VarPicker';
import type { VarNode as MonacoVarNode } from '@/components/common/MonacoEditor';
import dynamic from 'next/dynamic';

// 艹！动态导入Monaco编辑器，避免SSR问题！
const MonacoEditor = dynamic(() => import('@/components/common/MonacoEditor'), {
  ssr: false,
  loading: () => <div style={{ padding: '48px', textAlign: 'center' }}>Monaco编辑器加载中...</div>,
});

const { TextArea } = Input;

const mapVarsToMonaco = (nodes: VarNode[]): MonacoVarNode[] => {
  return nodes.map((node) => ({
    label: node.title,
    path: node.path,
    type: (node.type as MonacoVarNode['type']) || 'string',
    description: `${node.source}变量`,
    children: node.children ? mapVarsToMonaco(node.children) : undefined,
  }));
};

/**
 * 节点Inspector Props
 */
export interface NodeInspectorProps {
  /** 选中的节点ID */
  nodeId?: string;

  /** 节点类型 */
  nodeType?: string;

  /** 节点配置数据 */
  nodeData?: any;

  /** 可用的上游节点（用于构建变量树） */
  upstreamNodes?: Array<{ nodeId: string; outputs: string[] }>;

  /** 表单字段（用于构建form变量） */
  formFields?: string[];

  /** 配置变更回调 */
  onChange?: (nodeId: string, data: any) => void;
}

/**
 * 节点Inspector组件
 * 艹！这个组件让用户配置节点参数，集成变量选择器！
 */
export const NodeInspector: React.FC<NodeInspectorProps> = ({
  nodeId,
  nodeType,
  nodeData = {},
  upstreamNodes = [],
  formFields = [],
  onChange,
}) => {
  const [form] = Form.useForm();
  const [showVarPicker, setShowVarPicker] = useState(false);
  const [currentField, setCurrentField] = useState<string>('');

  /**
   * 构建可用变量树
   * 艹！根据上游节点和表单字段动态构建！
   */
  const availableVars: VarNode[] = useMemo(
    () =>
      buildDefaultVarTree({
        formFields,
        nodeOutputs: upstreamNodes,
      }),
    [formFields, upstreamNodes],
  );

  const monacoVars = useMemo(() => mapVarsToMonaco(availableVars), [availableVars]);

  /**
   * 处理变量选择
   * 艹！将选中的变量插入到当前编辑的字段！
   */
  const handleVarSelect = (varPath: string) => {
    if (!currentField) return;

    const currentValue = form.getFieldValue(currentField) || '';
    const newValue = currentValue + varPath;

    form.setFieldValue(currentField, newValue);
    message.success(`已插入变量: ${varPath}`);
  };

  /**
   * 打开变量选择器
   */
  const openVarPicker = (fieldName: string) => {
    setCurrentField(fieldName);
    setShowVarPicker(true);
  };

  /**
   * 保存配置
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 艹！校验变量引用
      const inputMapping = values.inputMapping || '';
      const validation = validateVarReferences(inputMapping, availableVars);

      if (!validation.isValid) {
        message.error(
          `发现${validation.undefinedPaths.length}个未定义的变量: ${validation.undefinedPaths.join(', ')}`
        );
        return;
      }

      if (nodeId) {
        onChange?.(nodeId, values);
        message.success('配置已保存');
      }
    } catch (error) {
      console.error('[NodeInspector] 保存失败', error);
    }
  };

  if (!nodeId) {
    return (
      <Card title="节点配置">
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          请选择一个节点进行配置
        </div>
      </Card>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <Card title={`配置节点: ${nodeType || nodeId}`}>
        <Form
          form={form}
          layout="vertical"
          initialValues={nodeData}
          onFinish={handleSave}
        >
          {/* Provider类型 */}
          <Form.Item
            label="Provider类型"
            name="providerType"
            rules={[{ required: true, message: '请选择Provider类型' }]}
          >
            <Select placeholder="选择Provider类型">
              <Select.Option value="GENERIC_HTTP">通用HTTP</Select.Option>
              <Select.Option value="TENCENT_CI">腾讯云万象</Select.Option>
              <Select.Option value="RUNNINGHUB">RunningHub</Select.Option>
              <Select.Option value="SCF">腾讯云函数</Select.Option>
            </Select>
          </Form.Item>

          {/* Provider引用 */}
          <Form.Item
            label="Provider引用"
            name="providerRef"
            tooltip="从Provider管理中选择已配置的Provider实例"
          >
            <Input placeholder="provider-ref-id" />
          </Form.Item>

          {/* 超时时间 */}
          <Form.Item label="超时时间 (ms)" name="timeout" initialValue={30000}>
            <Input type="number" placeholder="30000" />
          </Form.Item>

          <Divider>输入映射</Divider>

          {/* 输入映射 */}
          <Form.Item
            label={
              <Space>
                <span>输入映射 (JSON)</span>
                <Button size="small" onClick={() => openVarPicker('inputMapping')}>
                  选择变量
                </Button>
              </Space>
            }
            name="inputMapping"
            tooltip="使用{{}}占位符引用变量，输入{{自动补全可用变量"
          >
            <MonacoEditor
              value={form.getFieldValue('inputMapping') || '{\n  "url": "{{form.imageUrl}}",\n  "userId": "{{system.userId}}"\n}'}
              onChange={(value) => form.setFieldValue('inputMapping', value)}
              language="json"
              height={250}
              theme="vs-dark"
              showActions={true}
              enableVarCompletion={true}
              availableVars={monacoVars}
            />
          </Form.Item>

          {/* 输出映射 */}
          <Form.Item
            label="输出字段名"
            name="outputKey"
            tooltip="定义此节点的输出字段名，可被下游节点引用"
          >
            <Input placeholder="result" />
          </Form.Item>

          {/* 保存按钮 */}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存配置
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 变量选择器（Drawer或Modal） */}
      {showVarPicker && (
        <Card
          title="选择变量"
          style={{ marginTop: '16px' }}
          extra={
            <Button onClick={() => setShowVarPicker(false)}>关闭</Button>
          }
        >
          <VarPicker
            variables={availableVars}
            onSelect={handleVarSelect}
            showValidation={true}
            height={300}
          />
        </Card>
      )}
    </div>
  );
};

export default NodeInspector;
