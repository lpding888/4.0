/**
 * Pipeline协同编辑Hook
 * 艹，这个Hook必须封装所有协作功能，让组件用起来简单！
 *
 * @author 老王
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';
import { PipelineCollaboration, CollaborativeUser, VersionSnapshot } from '@/lib/collaboration/pipeline-collab';

const generateUserColor = (userId?: string): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ];
  const base = userId || 'anonymous';
  const hash = base.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = Math.abs(hash) % colors.length;
  const paletteColor = colors[index];
  return paletteColor ?? '#4ECDC4';
};

// 协作状态
export interface CollaborationState {
  isConnected: boolean;
  onlineUsers: CollaborativeUser[];
  currentUser: CollaborativeUser | null;
  operationCount: number;
  lastSyncTime: number;
  conflicts: any[];
}

// 协作配置
export interface CollaborationConfig {
  pipelineId: string;
  userId: string;
  userName: string;
  serverUrl: string;
  autoConnect?: boolean;
}

export function usePipelineCollaboration(config: CollaborationConfig) {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    onlineUsers: [],
    currentUser: null,
    operationCount: 0,
    lastSyncTime: 0,
    conflicts: []
  });

  const collaborationRef = useRef<PipelineCollaboration | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化协作实例
  useEffect(() => {
    const collab = new PipelineCollaboration(
      config.pipelineId,
      config.userId,
      config.userName
    );

    collaborationRef.current = collab;

    // 设置事件监听器
    setupEventListeners(collab);

    // 自动连接
    if (config.autoConnect !== false) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      collab.destroy();
    };
  }, [config.pipelineId, config.userId, config.userName]);

  // 设置事件监听器
  const setupEventListeners = (collab: PipelineCollaboration) => {
    // 连接状态变化
    collab.on('connection_status', (status: string) => {
      const isConnected = status === 'connected';
      setState(prev => ({
        ...prev,
        isConnected
      }));

      if (isConnected) {
        message.success('已连接到协作服务器');
      } else if (status === 'error') {
        message.error('连接协作服务器失败');
        scheduleReconnect();
      } else if (status === 'disconnected') {
        message.warning('已断开协作连接');
      }
    });

    // 用户加入
    collab.on('user_joined', (user: CollaborativeUser) => {
      setState(prev => ({
        ...prev,
        onlineUsers: [...prev.onlineUsers.filter(u => u.id !== user.id), user]
      }));
      message.info(`${user.name} 加入了协作编辑`);
    });

    // 用户离开
    collab.on('user_left', (user: CollaborativeUser) => {
      setState(prev => ({
        ...prev,
        onlineUsers: prev.onlineUsers.filter(u => u.id !== user.id)
      }));
      message.info(`${user.name} 离开了协作编辑`);
    });

    // 用户状态更新
    collab.on('user_updated', (user: CollaborativeUser) => {
      setState(prev => ({
        ...prev,
        onlineUsers: prev.onlineUsers.map(u =>
          u.id === user.id ? user : u
        )
      }));
    });

    // 节点变化
    collab.on('node_changed', (operation: any) => {
      setState(prev => ({
        ...prev,
        operationCount: prev.operationCount + 1,
        lastSyncTime: Date.now()
      }));
    });

    // 边变化
    collab.on('edge_changed', (operation: any) => {
      setState(prev => ({
        ...prev,
        operationCount: prev.operationCount + 1,
        lastSyncTime: Date.now()
      }));
    });

    // 快照创建
    collab.on('snapshot_created', (snapshot: VersionSnapshot) => {
      message.success(`快照已创建: ${snapshot.description}`);
    });

    // 回滚完成
    collab.on('rollback_completed', (snapshot: VersionSnapshot) => {
      message.success(`已回滚到版本: ${snapshot.description}`);
      // 触发数据刷新
      window.location.reload();
    });

    // 回滚失败
    collab.on('rollback_failed', ({ snapshotId, error }: any) => {
      message.error(`回滚失败: ${error.message || '未知错误'}`);
    });
  };

  // 安排重连
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('[Pipeline协作] 尝试重连...');
      connect();
    }, 5000);
  }, []);

  // 连接到协作服务器
  const connect = useCallback(async () => {
    if (!collaborationRef.current) return false;

    try {
      const success = await collaborationRef.current.connect(
        config.serverUrl,
        config.pipelineId
      );

      if (success) {
        // 设置当前用户信息
        const currentUser: CollaborativeUser = {
          id: config.userId,
          name: config.userName,
          color: generateUserColor(config.userId),
          status: 'online'
        };

        setState(prev => ({
          ...prev,
          currentUser
        }));
      }

      return success;
    } catch (error) {
      console.error('[Pipeline协作] 连接失败:', error);
      return false;
    }
  }, [config]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (collaborationRef.current) {
      collaborationRef.current.disconnect();
    }
  }, []);

  // 更新光标位置
  const updateCursor = useCallback((cursor: CollaborativeUser['cursor']) => {
    collaborationRef.current?.updateCursor(cursor);
  }, []);

  // 清除光标
  const clearCursor = useCallback(() => {
    collaborationRef.current?.clearCursor();
  }, []);

  // 添加节点
  const addNode = useCallback((nodeId: string, nodeData: any) => {
    collaborationRef.current?.addNode(nodeId, nodeData);
  }, []);

  // 更新节点
  const updateNode = useCallback((nodeId: string, updates: any) => {
    collaborationRef.current?.updateNode(nodeId, updates);
  }, []);

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    collaborationRef.current?.deleteNode(nodeId);
  }, []);

  // 添加边
  const addEdge = useCallback((edgeId: string, edgeData: any) => {
    collaborationRef.current?.addEdge(edgeId, edgeData);
  }, []);

  // 更新边
  const updateEdge = useCallback((edgeId: string, updates: any) => {
    collaborationRef.current?.updateEdge(edgeId, updates);
  }, []);

  // 删除边
  const deleteEdge = useCallback((edgeId: string) => {
    collaborationRef.current?.deleteEdge(edgeId);
  }, []);

  // 创建快照
  const createSnapshot = useCallback((description?: string) => {
    if (!collaborationRef.current) return '';
    return collaborationRef.current.createSnapshot(description);
  }, []);

  // 获取快照列表
  const getSnapshots = useCallback((): VersionSnapshot[] => {
    return collaborationRef.current?.getSnapshots() || [];
  }, []);

  // 回滚到快照
  const rollbackToSnapshot = useCallback(async (snapshotId: string) => {
    if (!collaborationRef.current) return false;
    return collaborationRef.current.rollbackToSnapshot(snapshotId);
  }, []);

  // 获取当前数据
  const getCurrentData = useCallback(() => {
    return collaborationRef.current?.getCurrentData() || {
      nodes: {},
      edges: {},
      operations: [],
      snapshots: []
    };
  }, []);

  // 检查用户是否正在编辑特定节点
  const isUserEditingNode = useCallback((nodeId: string): CollaborativeUser | null => {
    const users = state.onlineUsers.filter(user =>
      user.cursor?.nodeId === nodeId && user.status === 'editing'
    );
    return users[0] ?? null;
  }, [state.onlineUsers]);

  // 获取用户光标信息
  const getUserCursors = useCallback((): CollaborativeUser[] => {
    return state.onlineUsers.filter(user =>
      user.cursor && user.status === 'editing'
    );
  }, [state.onlineUsers]);

  return {
    // 状态
    state,

    // 连接管理
    connect,
    disconnect,

    // 用户管理
    updateCursor,
    clearCursor,
    getOnlineUsers: () => state.onlineUsers,
    getCurrentUser: () => state.currentUser,
    isUserEditingNode,
    getUserCursors,

    // 数据操作
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,

    // 版本管理
    createSnapshot,
    getSnapshots,
    rollbackToSnapshot,

    // 数据获取
    getCurrentData,

    // 协作实例（用于高级操作）
    collaboration: collaborationRef.current
  };
}
