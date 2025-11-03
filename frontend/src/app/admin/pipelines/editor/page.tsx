'use client';

/**
 * Pipeline流程编辑器页面
 * 艹，这个tm是拖拽构建AI Pipeline的核心页面！
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, Button, Space, message, Drawer, Input, Modal, Form, Select, Tag } from 'antd';
import {
  BranchesOutlined,
  SaveOutlined,
  CodeOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  UserOutlined,
  SyncOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  Node,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/flow/NodeTypes';
import NodeConfigDrawer from '@/components/flow/NodeConfigDrawer';
import ValidationPanel, { ValidationResult } from '@/components/flow/ValidationPanel';
import { usePipelineCollaboration } from '@/hooks/usePipelineCollaboration';
import CollaborationPresence from '@/components/collaboration/CollaborationPresence';
import { adminPipelines } from '@/lib/services/adminPipelines';
import { PipelineSchema, PipelineDTO, PipelineEdge } from '@/lib/types/pipeline';
import { validatePipelineSchema } from '@/lib/validators';
import { validatePipelineTopology } from '@/lib/utils/pipelineTopology';
import api from '@/lib/api';

/**
 * 初始节点示例
 */
const initialNodes = [
  {
    id: '1',
    type: 'provider',
    position: { x: 250, y: 50 },
    data: { label: 'OpenAI GPT-4', providerRef: 'openai-gpt4' },
  },
  {
    id: '2',
    type: 'condition',
    position: { x: 250, y: 200 },
    data: { label: '判断结果质量', condition: 'output.quality > 0.8' },
  },
  {
    id: '3',
    type: 'postProcess',
    position: { x: 100, y: 350 },
    data: { label: '结果优化', processor: 'enhance' },
  },
  {
    id: '4',
    type: 'end',
    position: { x: 400, y: 350 },
    data: { label: '直接输出' },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3', sourceHandle: 'true' },
  { id: 'e2-4', source: '2', target: '4', sourceHandle: 'false' },
];

/**
 * Pipeline编辑器内部组件
 * 艹！使用React Flow的hooks，必须在ReactFlowProvider内部！
 */
function PipelineEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [jsonDrawerVisible, setJsonDrawerVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);

  // Pipeline状态
  const [currentPipeline, setCurrentPipeline] = useState<PipelineDTO | null>(null);
  const [pipelineName, setPipelineName] = useState('未命名Pipeline');
  const [saving, setSaving] = useState(false);

  // Modal状态
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineDTO[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  // 校验状态 (CMS-209)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationDrawerVisible, setValidationDrawerVisible] = useState(false);

  const [form] = Form.useForm();
  const reactFlowInstance = useReactFlow();

  // 协同编辑状态
  const collaboration = usePipelineCollaboration({
    pipelineId: currentPipeline?.pipeline_id || 'default',
    userId: `user_${Math.random().toString(36).substr(2, 9)}`,
    userName: '当前用户',
    serverUrl: 'ws://localhost:1234', // 这里应该是实际的WebSocket服务器地址
    autoConnect: !!currentPipeline?.pipeline_id
  });

  /**
   * 连线回调
   */
  const onConnect = useCallback(
    (params: Connection) => {
      const edgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 使用协作编辑添加边
      collaboration.addEdge(edgeId, {
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        data: {} // 可选的边数据
      });

      // 本地状态更新（立即响应）
      setEdges((eds) => addEdge({ ...params, id: edgeId }, eds));
    },
    [collaboration, setEdges]
  );

  /**
   * 节点点击回调
   * 艹，点击节点时打开配置侧边栏！
   */
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('[点击节点]', node);
    setSelectedNode(node);
    setConfigDrawerOpen(true);

    // 更新协作光标
    collaboration.updateCursor({
      nodeId: node.id,
      x: node.position.x,
      y: node.position.y
    });
  }, [collaboration]);

  /**
   * 保存节点配置
   * 艹，更新节点的data！
   */
  const handleSaveNodeConfig = useCallback(
    (nodeId: string, newData: any) => {
      // 使用协作编辑更新节点
      collaboration.updateNode(nodeId, newData);

      // 本地状态更新（立即响应）
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...newData,
              },
            };
          }
          return node;
        })
      );
    },
    [collaboration, setNodes]
  );

  /**
   * 计算可用变量
   * 艹，根据节点拓扑顺序，找出当前节点之前的所有节点输出！
   */
  const availableVariables = useMemo(() => {
    if (!selectedNode) return [];

    // 找出所有在当前节点之前的节点
    const vars: string[] = [];

    // 简化版：遍历所有节点，添加变量
    nodes.forEach((node) => {
      if (node.id === selectedNode.id) return; // 跳过当前节点

      // 根据节点类型添加输出变量
      if (node.type === 'provider') {
        vars.push(`${node.id}.output`);
        vars.push(`${node.id}.tokens`);
      } else if (node.type === 'postProcess') {
        vars.push(`${node.id}.result`);
      }
    });

    return vars;
  }, [selectedNode, nodes]);

  /**
   * 添加Provider节点
   */
  const addProviderNode = () => {
    const id = `provider-${Date.now()}`;
    const newNode = {
      id,
      type: 'provider',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '新Provider', providerRef: '' },
    };

    // 使用协作编辑添加节点
    collaboration.addNode(id, newNode.data);

    // 本地状态更新（立即响应）
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加条件节点
   */
  const addConditionNode = () => {
    const id = `condition-${Date.now()}`;
    const newNode = {
      id,
      type: 'condition',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '新条件', condition: '' },
    };

    collaboration.addNode(id, newNode.data);
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加后处理节点
   */
  const addPostProcessNode = () => {
    const id = `postprocess-${Date.now()}`;
    const newNode = {
      id,
      type: 'postProcess',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '新后处理', processor: '' },
    };

    collaboration.addNode(id, newNode.data);
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加结束节点
   */
  const addEndNode = () => {
    const id = `end-${Date.now()}`;
    const newNode = {
      id,
      type: 'end',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '结束' },
    };

    collaboration.addNode(id, newNode.data);
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加FORK节点 (CMS-206)
   * 艹！分叉执行流到多个并行分支！
   */
  const addForkNode = () => {
    const id = `fork-${Date.now()}`;
    const newNode = {
      id,
      type: 'fork',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: 'FORK', branches: 2 },
    };

    collaboration.addNode(id, newNode.data);
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加JOIN节点 (CMS-206)
   * 艹！汇合多个并行分支！
   */
  const addJoinNode = () => {
    const id = `join-${Date.now()}`;
    const newNode = {
      id,
      type: 'join',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: 'JOIN', strategy: 'ALL' },
    };

    collaboration.addNode(id, newNode.data);
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 加载Pipeline列表
   * 艹，从后端获取所有Pipeline！
   */
  const loadPipelineList = async () => {
    setLoadingPipelines(true);
    try {
      const response = await adminPipelines.list({ page: 1, pageSize: 100 });
      setPipelines(response.items || []);
    } catch (error: any) {
      console.error('[加载Pipeline列表失败]', error);
      message.error('加载Pipeline列表失败');
    } finally {
      setLoadingPipelines(false);
    }
  };

  /**
   * 打开保存Modal
   */
  const handleSave = () => {
    if (currentPipeline) {
      // 已有Pipeline，直接保存
      handleSaveToBackend();
    } else {
      // 新Pipeline，打开保存Modal
      form.setFieldsValue({ pipeline_name: pipelineName });
      setSaveModalVisible(true);
    }
  };

  /**
   * 保存Pipeline到后端
   * 艹，创建或更新Pipeline！
   */
  const handleSaveToBackend = async (name?: string) => {
    setSaving(true);
    try {
      const pipelineSchema: PipelineSchema = {
        version: '1.0',
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type || 'provider',
          position: n.position,
          data: n.data,
        })),
        // @ts-expect-error - 艹，老代码的React Flow Edge类型和我们的PipelineEdge不兼容，先绕过！
        edges: edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })) as PipelineEdge[],
        metadata: {
          title: name || pipelineName,
          updatedAt: new Date().toISOString(),
        },
      };

      // 艹，先用Zod校验Pipeline Schema！
      const validation = validatePipelineSchema(pipelineSchema);
      if (!validation.success) {
        console.error('[Pipeline Zod校验失败]', validation.errors);
        message.error(`Pipeline结构校验失败: ${validation.errors?.join('; ')}`);
        setSaving(false);
        return;
      }

      console.log('[Pipeline Zod校验通过]', validation.data);

      // 艹，再用Kahn算法进行拓扑校验！
      const topologyValidation = validatePipelineTopology(pipelineSchema);
      if (!topologyValidation.valid) {
        console.error('[Pipeline拓扑校验失败]', topologyValidation.errors);
        message.error(`Pipeline拓扑校验失败: ${topologyValidation.errors.join('; ')}`);
        setSaving(false);
        return;
      }

      // 显示警告信息（不阻止保存）
      if (topologyValidation.warnings && topologyValidation.warnings.length > 0) {
        console.warn('[Pipeline拓扑警告]', topologyValidation.warnings);
        topologyValidation.warnings.forEach((warning) => {
          message.warning(warning, 3);
        });
      }

      console.log('[Pipeline拓扑校验通过]', {
        sortedNodes: topologyValidation.sortedNodeIds,
        reachableVars: topologyValidation.reachableVariables,
      });

      let result: PipelineDTO;

      if (currentPipeline?.pipeline_id) {
        // 更新现有Pipeline
        result = await adminPipelines.update(currentPipeline.pipeline_id, {
          pipeline_name: name || pipelineName,
          pipeline_json: pipelineSchema,
        });
        message.success('Pipeline已更新');
      } else {
        // 创建新Pipeline
        result = await adminPipelines.create({
          pipeline_name: name || pipelineName,
          pipeline_json: pipelineSchema,
          status: 'draft',
        });
        message.success('Pipeline已创建');
      }

      setCurrentPipeline(result);
      setPipelineName(result.pipeline_name);
      setSaveModalVisible(false);
    } catch (error: any) {
      console.error('[保存Pipeline失败]', error);
      message.error(error.response?.data?.message || '保存Pipeline失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 加载Pipeline
   * 艹，从后端读取并应用到画布！
   */
  const handleLoadPipeline = async (pipelineId: string) => {
    try {
      const pipeline = await adminPipelines.get(pipelineId);
      const schema = pipeline.pipeline_json;

      // 应用到画布
      if (schema.nodes) {
        setNodes(
          schema.nodes.map((n) => ({
            ...n,
            type: n.type || 'provider',
          })) as any
        );
      }
      if (schema.edges) {
        setEdges(schema.edges as any);
      }

      setCurrentPipeline(pipeline);
      setPipelineName(pipeline.pipeline_name);
      setLoadModalVisible(false);
      message.success(`已加载Pipeline: ${pipeline.pipeline_name}`);
    } catch (error: any) {
      console.error('[加载Pipeline失败]', error);
      message.error('加载Pipeline失败');
    }
  };

  /**
   * 新建Pipeline
   * 艹，清空画布重新开始！
   */
  const handleNewPipeline = () => {
    Modal.confirm({
      title: '新建Pipeline',
      content: '当前编辑内容将被清空，确认新建？',
      onOk: () => {
        setNodes([]);
        setEdges([]);
        setCurrentPipeline(null);
        setPipelineName('未命名Pipeline');
        message.success('已清空画布');
      },
    });
  };

  /**
   * 导出JSON (CMS-210)
   * 艹！导出完整Pipeline Schema，包含元数据！
   */
  const handleExportJSON = () => {
    const pipelineSchema: PipelineSchema = {
      version: '1.0',
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || 'provider',
        position: n.position,
        data: n.data,
      })),
      // @ts-expect-error - Edge类型兼容性
      edges: edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })) as PipelineEdge[],
      metadata: {
        title: pipelineName,
        description: currentPipeline?.pipeline_json?.metadata?.description || '',
        exportedAt: new Date().toISOString(),
        nodesCount: nodes.length,
        edgesCount: edges.length,
      },
    };

    const json = JSON.stringify(pipelineSchema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${pipelineName.replace(/\s+/g, '_')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Pipeline JSON已导出（包含完整Schema）');
  };

  /**
   * 导入JSON (CMS-210)
   * 艹！从JSON文件导入Pipeline！
   */
  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);

        // 校验JSON格式
        if (!json.nodes || !Array.isArray(json.nodes)) {
          throw new Error('无效的Pipeline JSON：缺少nodes数组');
        }

        if (!json.edges || !Array.isArray(json.edges)) {
          throw new Error('无效的Pipeline JSON：缺少edges数组');
        }

        // 确认导入
        Modal.confirm({
          title: '确认导入Pipeline',
          content: (
            <div>
              <p>将导入以下Pipeline：</p>
              <ul>
                <li>名称: {json.metadata?.title || '未命名'}</li>
                <li>节点数: {json.nodes.length}</li>
                <li>连线数: {json.edges.length}</li>
                {json.metadata?.exportedAt && (
                  <li>导出时间: {new Date(json.metadata.exportedAt).toLocaleString()}</li>
                )}
              </ul>
              <p style={{ color: '#ff4d4f', marginTop: '12px' }}>
                当前画布内容将被替换，确认导入？
              </p>
            </div>
          ),
          onOk: () => {
            // 应用到画布
            setNodes(
              json.nodes.map((n: any) => ({
                ...n,
                type: n.type || 'provider',
              })) as any
            );
            setEdges(json.edges as any);

            // 更新Pipeline信息
            setCurrentPipeline(null); // 清空当前Pipeline引用
            setPipelineName(json.metadata?.title || '导入的Pipeline');

            message.success('Pipeline导入成功');
          },
        });
      } catch (error: any) {
        console.error('[导入失败]', error);
        message.error(`导入失败: ${error.message || '无效的JSON格式'}`);
      }
    };
    input.click();
  };

  /**
   * 校验Pipeline拓扑 (CMS-209)
   * 艹！调用后端API进行Kahn算法校验和变量可达性检查！
   */
  const handleValidate = async () => {
    setValidating(true);
    try {
      // 调用后端校验API
      const response: any = await api.client.post('/admin/pipelines/validate', {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type || 'provider',
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
      });

      if (response.data?.success) {
        const validation: ValidationResult = response.data.data;
        setValidationResult(validation);
        setValidationDrawerVisible(true);

        if (validation.valid) {
          message.success('校验通过！Pipeline结构合法。');
        } else {
          message.error(`发现${validation.errors.length}个错误，请查看校验面板。`);
        }
      } else {
        throw new Error(response.data?.error?.message || '校验失败');
      }
    } catch (error: any) {
      console.error('[Pipeline校验失败]', error);
      message.error(`校验失败: ${error.message || '未知错误'}`);
    } finally {
      setValidating(false);
    }
  };

  /**
   * 点击错误定位节点 (CMS-209)
   * 艹！高亮并聚焦到有错误的节点！
   */
  const handleErrorClick = (errorOrNodeId: string) => {
    // 尝试从错误消息中提取节点ID
    const match = errorOrNodeId.match(/"([^"]+)"/);
    const nodeId = match ? match[1] : errorOrNodeId;

    console.log('[定位节点]', nodeId);

    // 查找节点
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      message.warning(`未找到节点: ${nodeId}`);
      return;
    }

    // 高亮节点（通过修改节点样式）
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              highlighted: true,
            },
            style: {
              ...n.style,
              border: '2px solid #ff4d4f',
              boxShadow: '0 0 10px rgba(255, 77, 79, 0.5)',
            },
          };
        }
        return {
          ...n,
          data: {
            ...n.data,
            highlighted: false,
          },
          style: {
            ...n.style,
            border: undefined,
            boxShadow: undefined,
          },
        };
      })
    );

    // 聚焦到节点
    if (reactFlowInstance && node.position) {
      reactFlowInstance.setCenter(
        node.position.x + 100, // 节点中心偏移
        node.position.y + 50,
        { zoom: 1.5, duration: 500 } // 缩放并动画
      );
    }

    message.info(`已定位节点: ${nodeId}`);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={16}>
        <Col span={18}>
          <Card
            title={
              <Space>
                <BranchesOutlined style={{ fontSize: '20px' }} />
                <span style={{ fontSize: '18px', fontWeight: 600 }}>Pipeline协同编辑器</span>
                <Tag color={currentPipeline ? 'green' : 'default'}>
                  {pipelineName}
                </Tag>
                {currentPipeline && (
                  <Tag color="blue">ID: {currentPipeline.pipeline_id}</Tag>
                )}
                {collaboration.state.isConnected && (
                  <Tag color="green" icon={<SyncOutlined spin />}>
                    协作中
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Space>
                <Button icon={<FileAddOutlined />} onClick={handleNewPipeline}>
                  新建
                </Button>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={() => {
                    loadPipelineList();
                    setLoadModalVisible(true);
                  }}
                >
                  打开
                </Button>
                <Button icon={<CloudUploadOutlined />} onClick={handleImportJSON}>
                  导入JSON
                </Button>
                <Button.Group>
                  <Button icon={<PlusOutlined />} onClick={addProviderNode}>
                    Provider
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={addConditionNode}>
                    条件
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={addPostProcessNode}>
                    后处理
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={addForkNode}>
                    FORK
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={addJoinNode}>
                    JOIN
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={addEndNode}>
                    结束
                  </Button>
                </Button.Group>
                <Button icon={<CodeOutlined />} onClick={() => setJsonDrawerVisible(true)}>
                  查看JSON
                </Button>
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={handleValidate}
                  loading={validating}
                  type={validationResult?.valid ? 'default' : 'dashed'}
                >
                  {validating ? '校验中' : '校验'}
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                >
                  {currentPipeline ? '保存' : '另存为'}
                </Button>
              </Space>
            }
          >
            {/* 流程画布 */}
            <div style={{ height: '700px', border: '1px solid #d9d9d9', borderRadius: '8px', position: 'relative' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeDragStop={(event, node) => {
                  // 更新协作光标位置
                  collaboration.updateCursor({
                    nodeId: node.id,
                    x: node.position.x,
                    y: node.position.y
                  });
                }}
                onPaneClick={(event) => {
                  // 清除协作光标
                  collaboration.clearCursor();
                }}
                nodeTypes={nodeTypes}
                fitView
              >
                <Controls />
                <MiniMap />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              </ReactFlow>

              {/* 显示其他用户的协作光标 */}
              {collaboration.getUserCursors().map((user) => (
                <div
                  key={user.id}
                  style={{
                    position: 'absolute',
                    left: user.cursor?.x || 0,
                    top: user.cursor?.y || 0,
                    pointerEvents: 'none',
                    zIndex: 1000,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      padding: '2px 6px',
                      backgroundColor: user.color,
                      color: 'white',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      animation: 'pulse 1.5s infinite'
                    }}
                  >
                    {user.name}
                    {user.cursor?.nodeId && (
                      <div style={{ fontSize: 9, opacity: 0.8 }}>
                        编辑: {user.cursor.nodeId}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={6}>
          {/* 协作编辑面板 */}
          <CollaborationPresence
            onlineUsers={collaboration.state.onlineUsers}
            currentUser={collaboration.state.currentUser}
            isConnected={collaboration.state.isConnected}
            snapshots={collaboration.getSnapshots()}
            onCreateSnapshot={(description) => collaboration.createSnapshot(description)}
            onRollback={(snapshotId) => collaboration.rollbackToSnapshot(snapshotId)}
          />
        </Col>
      </Row>

      {/* 节点配置侧边栏 */}
      <NodeConfigDrawer
        open={configDrawerOpen}
        node={selectedNode}
        onClose={() => setConfigDrawerOpen(false)}
        onSave={handleSaveNodeConfig}
        availableVariables={availableVariables}
      />

      {/* JSON Drawer */}
      <Drawer
        title="Pipeline JSON"
        width={600}
        open={jsonDrawerVisible}
        onClose={() => setJsonDrawerVisible(false)}
        extra={
          <Button icon={<CodeOutlined />} onClick={handleExportJSON}>
            导出JSON
          </Button>
        }
      >
        <pre
          style={{
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        >
          {JSON.stringify({ nodes, edges }, null, 2)}
        </pre>
      </Drawer>

      {/* 保存Pipeline Modal */}
      <Modal
        title={<Space><SaveOutlined /> 保存Pipeline</Space>}
        open={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onOk={() => {
          form.validateFields().then((values) => {
            handleSaveToBackend(values.pipeline_name);
          });
        }}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Pipeline名称"
            name="pipeline_name"
            rules={[
              { required: true, message: '请输入Pipeline名称' },
              { min: 2, message: '名称至少2个字符' },
            ]}
          >
            <Input placeholder="例如：用户问答Pipeline" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 打开Pipeline Modal */}
      <Modal
        title={<Space><FolderOpenOutlined /> 打开Pipeline</Space>}
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={700}
      >
        {loadingPipelines ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <p>加载中...</p>
          </div>
        ) : pipelines.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px',
              color: '#999',
            }}
          >
            <BranchesOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <p>暂无Pipeline</p>
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {pipelines.map((pipeline) => (
              <Card
                key={pipeline.pipeline_id}
                size="small"
                hoverable
                style={{ marginBottom: '12px', cursor: 'pointer' }}
                onClick={() => pipeline.pipeline_id && handleLoadPipeline(pipeline.pipeline_id)}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <BranchesOutlined />
                    <span style={{ fontWeight: 600 }}>{pipeline.pipeline_name}</span>
                    <Tag color={pipeline.status === 'published' ? 'green' : 'default'}>
                      {pipeline.status === 'published' ? '已发布' : '草稿'}
                    </Tag>
                  </Space>
                  {pipeline.pipeline_json?.metadata?.description && (
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {pipeline.pipeline_json.metadata.description}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    更新时间: {pipeline.updated_at || '未知'}
                  </div>
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* 校验结果面板 (CMS-209) - 艹！显示错误和警告列表，支持点击定位节点！ */}
      <Drawer
        title={<Space><CheckCircleOutlined /> Pipeline校验结果</Space>}
        width={450}
        open={validationDrawerVisible}
        onClose={() => setValidationDrawerVisible(false)}
        bodyStyle={{ padding: '16px' }}
      >
        <ValidationPanel
          validation={validationResult}
          loading={validating}
          onErrorClick={handleErrorClick}
          onWarningClick={handleErrorClick}
          onRevalidate={handleValidate}
        />
      </Drawer>
    </div>
  );
}

/**
 * Pipeline编辑器页面
 * 艹！包裹ReactFlowProvider，否则zustand会报错！
 */
export default function PipelineEditorPage() {
  return (
    <ReactFlowProvider>
      <PipelineEditor />
    </ReactFlowProvider>
  );
}
