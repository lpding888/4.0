/**
 * Pipeline协同编辑核心模块
 * 艹，这个模块必须完美支持Yjs/CRDT多人实时协作，还要有Presence显示！
 *
 * @author 老王
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';

// 协作用户信息
export interface CollaborativeUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: {
    nodeId?: string;
    x?: number;
    y?: number;
    selection?: string;
  };
  status: 'online' | 'offline' | 'editing';
}

// 协作操作类型
export interface CollaborationOperation {
  type: 'node_add' | 'node_update' | 'node_delete' | 'edge_add' | 'edge_update' | 'edge_delete';
  userId: string;
  timestamp: number;
  data: any;
  metadata?: any;
}

// 版本快照
export interface VersionSnapshot {
  id: string;
  version: number;
  timestamp: number;
  userId: string;
  description: string;
  data: {
    nodes: any[];
    edges: any[];
  };
  operations: number;
}

// 冲突解决策略
export interface ConflictResolution {
  strategy: 'last_writer_wins' | 'manual' | 'merge';
  operationA: CollaborationOperation;
  operationB: CollaborationOperation;
  resolvedOperation: CollaborationOperation;
  conflictReason: string;
}

// Pipeline协同编辑类
export class PipelineCollaboration {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private awareness: Awareness;
  private yNodes: Y.Map<any>;
  private yEdges: Y.Map<any>;
  private yOperations: Y.Array<any>;
  private ySnapshots: Y.Array<any>;

  private userId: string;
  private userName: string;
  private userColor: string;

  private listeners: Map<string, Function[]> = new Map();
  private operationCount = 0;
  private lastSnapshotVersion = 0;

  // WebSocket连接状态
  private connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';

  // 在线用户
  private onlineUsers: Map<string, CollaborativeUser> = new Map();

  // 冲突处理
  private pendingConflicts: ConflictResolution[] = [];

  constructor(pipelineId: string, userId: string, userName: string) {
    this.userId = userId;
    this.userName = userName;
    this.userColor = this.generateUserColor(userId);

    // 初始化Yjs文档
    this.doc = new Y.Doc();

    // 初始化数据结构
    this.yNodes = this.doc.getMap('nodes');
    this.yEdges = this.doc.getMap('edges');
    this.yOperations = this.doc.getArray('operations');
    this.ySnapshots = this.doc.getArray('snapshots');

    // 初始化Awareness
    this.awareness = new Awareness(this.doc);
    this.setupAwareness();

    console.log(`[Pipeline协作] 初始化完成 - Pipeline: ${pipelineId}, User: ${userId}`);
  }

  // 生成用户颜色
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = Math.abs(hash) % colors.length;
    const paletteColor = colors[index];
    return paletteColor ?? '#4ECDC4';
  }

  // 设置用户状态
  private setupAwareness() {
    this.awareness.setLocalState({
      user: {
        id: this.userId,
        name: this.userName,
        color: this.userColor,
        status: 'online' as const,
        cursor: null
      }
    });

    // 监听用户状态变化
    this.awareness.on('update', ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
      const states = this.awareness.getStates() as Map<number, any>;

      // 处理新加入的用户
      added.forEach((userId: number) => {
        const state = states.get(userId);
        if (state?.user) {
          const clientKey = String(userId);
          this.onlineUsers.set(clientKey, state.user);
          this.emit('user_joined', state.user);
        }
      });

      // 处理更新的用户
      updated.forEach((userId: number) => {
        const state = states.get(userId);
        if (state?.user) {
          const clientKey = String(userId);
          this.onlineUsers.set(clientKey, state.user);
          this.emit('user_updated', state.user);
        }
      });

      // 处理离开的用户
      removed.forEach((userId: number) => {
        const clientKey = String(userId);
        const user = this.onlineUsers.get(clientKey);
        if (user) {
          this.onlineUsers.delete(clientKey);
          this.emit('user_left', user);
        }
      });
    });
  }

  // 连接到协作服务器
  async connect(serverUrl: string, pipelineId: string): Promise<boolean> {
    try {
      this.connectionStatus = 'connecting';
      this.emit('connection_status', this.connectionStatus);

      // 创建WebSocket Provider
      this.provider = new WebsocketProvider(
        `${serverUrl}/${pipelineId}`,
        pipelineId,
        this.doc,
        {
          awareness: this.awareness,
          params: {
            userId: this.userId,
            userName: this.userName
          }
        }
      );

      // 设置持久化
      new IndexeddbPersistence(`pipeline-${pipelineId}`, this.doc);

      // 监听连接状态
      this.provider.on('status', (event: any) => {
        this.connectionStatus = event.status;
        this.emit('connection_status', this.connectionStatus);

        if (event.status === 'connected') {
          console.log(`[Pipeline协作] 已连接到服务器 - Pipeline: ${pipelineId}`);
          this.initializeFromPersistence();
        }
      });

      // 监听同步状态
      this.provider.on('sync', (isSynced: boolean) => {
        this.emit('sync_status', isSynced);
        if (isSynced) {
          console.log('[Pipeline协作] 数据已同步');
        }
      });

      // 监听数据变化
      this.setupDataListeners();

      return new Promise((resolve) => {
        this.provider?.on('status', (event: any) => {
          if (event.status === 'connected') {
            resolve(true);
          }
        });

        // 超时处理
        setTimeout(() => resolve(false), 10000);
      });

    } catch (error) {
      console.error('[Pipeline协作] 连接失败:', error);
      this.connectionStatus = 'error';
      this.emit('connection_status', this.connectionStatus);
      return false;
    }
  }

  // 从持久化数据初始化
  private initializeFromPersistence() {
    // 恢复操作计数
    this.operationCount = this.yOperations.length;

    // 恢复最新快照版本
    const snapshots = this.ySnapshots.toArray();
    if (snapshots.length > 0) {
      this.lastSnapshotVersion = Math.max(...snapshots.map(s => s.version));
    }

    console.log(`[Pipeline协作] 从持久化恢复 - 操作数: ${this.operationCount}, 快照版本: ${this.lastSnapshotVersion}`);
  }

  // 设置数据监听器
  private setupDataListeners() {
    // 监听节点变化
    this.yNodes.observe((event: Y.YMapEvent<any>) => {
      event.changes.keys.forEach((change, key) => {
        const operation: CollaborationOperation = {
          type: change.action === 'add' ? 'node_add' :
               change.action === 'update' ? 'node_update' : 'node_delete',
          userId: this.userId,
          timestamp: Date.now(),
          data: {
            nodeId: key,
            node: change.action === 'delete' ? null : this.yNodes.get(key)
          }
        };

        this.recordOperation(operation);
        this.emit('node_changed', operation);
      });
    });

    // 监听边变化
    this.yEdges.observe((event: Y.YMapEvent<any>) => {
      event.changes.keys.forEach((change, key) => {
        const operation: CollaborationOperation = {
          type: change.action === 'add' ? 'edge_add' :
               change.action === 'update' ? 'edge_update' : 'edge_delete',
          userId: this.userId,
          timestamp: Date.now(),
          data: {
            edgeId: key,
            edge: change.action === 'delete' ? null : this.yEdges.get(key)
          }
        };

        this.recordOperation(operation);
        this.emit('edge_changed', operation);
      });
    });
  }

  // 记录操作
  private recordOperation(operation: CollaborationOperation) {
    this.yOperations.push([operation]);
    this.operationCount++;

    // 每500个操作创建快照
    if (this.operationCount - this.lastSnapshotVersion >= 500) {
      this.createSnapshot('自动快照');
    }
  }

  // 创建快照
  createSnapshot(description: string = '手动快照'): string {
    const nodesState = this.yNodes.toJSON() as Record<string, any>;
    const edgesState = this.yEdges.toJSON() as Record<string, any>;

    const snapshot: VersionSnapshot = {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: this.operationCount,
      timestamp: Date.now(),
      userId: this.userId,
      description,
      data: {
        nodes: Object.values(nodesState),
        edges: Object.values(edgesState)
      },
      operations: this.operationCount - this.lastSnapshotVersion
    };

    this.ySnapshots.push([snapshot]);
    this.lastSnapshotVersion = this.operationCount;

    console.log(`[Pipeline协作] 创建快照 - 版本: ${snapshot.version}, 描述: ${description}`);
    this.emit('snapshot_created', snapshot);

    return snapshot.id;
  }

  // 获取所有快照
  getSnapshots(): VersionSnapshot[] {
    return this.ySnapshots.toArray();
  }

  // 回滚到指定快照
  async rollbackToSnapshot(snapshotId: string): Promise<boolean> {
    try {
      const snapshots = this.ySnapshots.toArray();
      const targetSnapshot = snapshots.find(s => s.id === snapshotId);

      if (!targetSnapshot) {
        throw new Error(`快照不存在: ${snapshotId}`);
      }

      // 清空当前数据
      this.doc.transact(() => {
        this.yNodes.clear();
        this.yEdges.clear();

        // 恢复快照数据
        Object.entries(targetSnapshot.data.nodes).forEach(([key, node]) => {
          this.yNodes.set(key, node);
        });

        Object.entries(targetSnapshot.data.edges).forEach(([key, edge]) => {
          this.yEdges.set(key, edge);
        });

        // 记录回滚操作
        const rollbackOperation: CollaborationOperation = {
          type: 'node_update', // 使用通用类型
          userId: this.userId,
          timestamp: Date.now(),
          data: {
            snapshotId: snapshotId,
            previousVersion: this.operationCount,
            targetVersion: targetSnapshot.version
          },
          metadata: {
            action: 'rollback'
          }
        };

        this.yOperations.push([rollbackOperation]);
      });

      console.log(`[Pipeline协作] 回滚完成 - 快照: ${snapshotId}, 版本: ${targetSnapshot.version}`);
      this.emit('rollback_completed', targetSnapshot);

      return true;

    } catch (error) {
      console.error('[Pipeline协作] 回滚失败:', error);
      this.emit('rollback_failed', { snapshotId, error });
      return false;
    }
  }

  // 更新用户光标
  updateCursor(cursor: CollaborativeUser['cursor']) {
    const currentState = this.awareness.getLocalState() || {};
    const currentUser = (currentState as any).user || {
      id: this.userId,
      name: this.userName,
      color: this.userColor,
      status: 'online'
    };
    this.awareness.setLocalState({
      ...currentState,
      user: {
        ...currentUser,
        cursor,
        status: 'editing'
      }
    });
  }

  // 清除光标
  clearCursor() {
    const currentState = this.awareness.getLocalState() || {};
    const currentUser = (currentState as any).user || {
      id: this.userId,
      name: this.userName,
      color: this.userColor,
      status: 'online'
    };
    this.awareness.setLocalState({
      ...currentState,
      user: {
        ...currentUser,
        cursor: null,
        status: 'online'
      }
    });
  }

  // 获取在线用户
  getOnlineUsers(): CollaborativeUser[] {
    return Array.from(this.onlineUsers.values());
  }

  // 获取连接状态
  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  // 添加节点（协作操作）
  addNode(nodeId: string, nodeData: any) {
    this.doc.transact(() => {
      this.yNodes.set(nodeId, {
        ...nodeData,
        createdAt: Date.now(),
        createdBy: this.userId
      });
    });
  }

  // 更新节点（协作操作）
  updateNode(nodeId: string, updates: any) {
    const existingNode = this.yNodes.get(nodeId);
    if (existingNode) {
      this.doc.transact(() => {
        this.yNodes.set(nodeId, {
          ...existingNode,
          ...updates,
          updatedAt: Date.now(),
          updatedBy: this.userId
        });
      });
    }
  }

  // 删除节点（协作操作）
  deleteNode(nodeId: string) {
    this.doc.transact(() => {
      this.yNodes.delete(nodeId);
    });
  }

  // 添加边（协作操作）
  addEdge(edgeId: string, edgeData: any) {
    this.doc.transact(() => {
      this.yEdges.set(edgeId, {
        ...edgeData,
        createdAt: Date.now(),
        createdBy: this.userId
      });
    });
  }

  // 更新边（协作操作）
  updateEdge(edgeId: string, updates: any) {
    const existingEdge = this.yEdges.get(edgeId);
    if (existingEdge) {
      this.doc.transact(() => {
        this.yEdges.set(edgeId, {
          ...existingEdge,
          ...updates,
          updatedAt: Date.now(),
          updatedBy: this.userId
        });
      });
    }
  }

  // 删除边（协作操作）
  deleteEdge(edgeId: string) {
    this.doc.transact(() => {
      this.yEdges.delete(edgeId);
    });
  }

  // 获取当前数据
  getCurrentData() {
    return {
      nodes: this.yNodes.toJSON(),
      edges: this.yEdges.toJSON(),
      operations: this.yOperations.toArray(),
      snapshots: this.ySnapshots.toArray()
    };
  }

  // 事件监听器
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // 移除事件监听器
  off(event: string, callback?: Function) {
    if (callback) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    } else {
      this.listeners.delete(event);
    }
  }

  // 触发事件
  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Pipeline协作] 事件处理错误 (${event}):`, error);
        }
      });
    }
  }

  // 断开连接
  disconnect() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    this.connectionStatus = 'disconnected';
    this.emit('connection_status', this.connectionStatus);

    console.log('[Pipeline协作] 已断开连接');
  }

  // 销毁
  destroy() {
    this.disconnect();
    this.doc.destroy();
    this.listeners.clear();
    this.onlineUsers.clear();

    console.log('[Pipeline协作] 已销毁');
  }
}
