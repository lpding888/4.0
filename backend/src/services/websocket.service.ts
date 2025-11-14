import { WebSocketServer, WebSocket as WSClient } from 'ws';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import tokenService from './token.service.js';
import permissionService from './permission.service.js';

/**
 * WebSocket配置接口
 */
interface WebSocketConfig {
  port: number | string;
  heartbeatInterval: number;
  maxConnections: number;
  messageQueueSize: number;
  reconnectDelay: number;
  pingTimeout: number;
}

/**
 * 连接信息接口
 */
interface ConnectionInfo {
  connectionId: string;
  ip: string | unknown;
  userAgent: string;
  connectedAt: number;
  authenticated: boolean;
  userId: string | null;
  token: string | null;
  userInfo?: unknown;
  subscriptions?: Set<string>;
}

/**
 * 消息类型接口
 */
interface MessageTypes {
  TASK_CREATED: string;
  TASK_STATUS_CHANGED: string;
  TASK_PROGRESS: string;
  TASK_COMPLETED: string;
  TASK_FAILED: string;
  SYSTEM_NOTIFICATION: string;
  USER_NOTIFICATION: string;
  MAINTENANCE_ALERT: string;
  PING: string;
  PONG: string;
  AUTH_SUCCESS: string;
  AUTH_FAILED: string;
  CONNECTION_ERROR: string;
  CHAT_MESSAGE: string;
  USER_STATUS: string;
  SYSTEM_STATS: string;
}

/**
 * 统计信息接口
 */
interface Statistics {
  totalConnections: number;
  activeConnections: number;
  messagesSent: number;
  messagesReceived: number;
  authFailures: number;
  lastReset: number;
}

/**
 * WebSocket消息接口
 */
interface WSMessage {
  type: string;
  data: unknown;
  id?: string | null;
}

/**
 * 聊天消息数据接口
 */
interface ChatMessageData {
  content: unknown;
  type?: string;
  targetId?: string | null;
}

/**
 * 认证数据接口
 */
interface AuthData {
  token: string;
}

/**
 * 订阅数据接口
 */
interface SubscriptionData {
  channels?: string[];
}

/**
 * 取消订阅数据接口
 */
interface UnsubscriptionData {
  channels?: string[];
}

/**
 * WebSocket服务
 *
 * 提供实时通信功能：
 * - 任务进度推送
 * - 系统通知
 * - 用户状态同步
 * - 连接管理
 * - 消息广播
 */
class WebSocketService {
  private wss: WebSocketServer | null = null;

  private clients: Map<string, Set<WSClient>> = new Map();

  private connections: Map<WSClient, ConnectionInfo> = new Map();

  public initialized = false;

  private heartbeatTimer: NodeJS.Timeout | null = null;

  private config: WebSocketConfig;

  private messageTypes: MessageTypes;

  private stats: Statistics;

  constructor() {
    this.config = {
      port: process.env.WS_PORT || 3001,
      heartbeatInterval: 30000, // 30秒心跳
      maxConnections: 10000,
      messageQueueSize: 100,
      reconnectDelay: 5000,
      pingTimeout: 60000 // 60秒无响应断开
    };

    // 消息类型
    this.messageTypes = {
      // 任务相关
      TASK_CREATED: 'task_created',
      TASK_STATUS_CHANGED: 'task_status_changed',
      TASK_PROGRESS: 'task_progress',
      TASK_COMPLETED: 'task_completed',
      TASK_FAILED: 'task_failed',

      // 系统通知
      SYSTEM_NOTIFICATION: 'system_notification',
      USER_NOTIFICATION: 'user_notification',
      MAINTENANCE_ALERT: 'maintenance_alert',

      // 连接管理
      PING: 'ping',
      PONG: 'pong',
      AUTH_SUCCESS: 'auth_success',
      AUTH_FAILED: 'auth_failed',
      CONNECTION_ERROR: 'connection_error',

      // 其他
      CHAT_MESSAGE: 'chat_message',
      USER_STATUS: 'user_status',
      SYSTEM_STATS: 'system_stats'
    };

    // 统计信息
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      authFailures: 0,
      lastReset: Date.now()
    };
  }

  /**
   * 初始化WebSocket服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[WebSocket] WebSocket服务已初始化');
      return;
    }

    try {
      // 确保权限服务已初始化
      await permissionService.initialize();

      // 创建WebSocket服务器
      const port =
        typeof this.config.port === 'string' ? Number(this.config.port) : this.config.port;
      this.wss = new WebSocketServer({
        port,
        verifyClient: this.verifyClient.bind(this)
      });

      // 设置事件监听器
      this.setupEventListeners();

      // 启动心跳检查
      this.startHeartbeat();

      this.initialized = true;
      logger.info(`[WebSocket] 服务启动成功，端口: ${this.config.port}`);
    } catch (error) {
      logger.error('[WebSocket] 服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 验证客户端连接
   * @param {Object} info - 连接信息
   * @returns {boolean} 是否允许连接
   * @private
   */
  verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      // 检查连接数限制
      if (this.stats.activeConnections >= this.config.maxConnections) {
        logger.warn('[WebSocket] 连接数已达上限，拒绝新连接');
        return false;
      }

      // 检查来源IP（可选）
      const clientIP = info.req.socket.remoteAddress;
      // if (this.isBlockedIP(clientIP)) {
      //   logger.warn(`[WebSocket] IP被封禁: ${clientIP}`);
      //   return false;
      // }

      return true;
    } catch (error) {
      logger.error('[WebSocket] 客户端验证失败:', error);
      return false;
    }
  }

  /**
   * 设置事件监听器
   * @private
   */
  setupEventListeners(): void {
    const server = this.wss;
    if (!server) {
      throw new Error('WebSocket server not initialized');
    }
    server.on('connection', (ws, req) => {
      void this.handleConnection(ws as WSClient, req);
    });
    server.on('error', this.handleServerError.bind(this));

    logger.info('[WebSocket] 事件监听器设置完成');
  }

  /**
   * 处理新连接
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} req - HTTP请求对象
   */
  async handleConnection(ws: WSClient, req: IncomingMessage): Promise<void> {
    const connectionId = this.generateConnectionId();
    const clientIP = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    logger.info(`[WebSocket] 新连接: ${connectionId}, IP: ${clientIP}`);

    // 设置连接属性
    ws.isAlive = true;
    ws.connectionId = connectionId;
    ws.ip = clientIP;
    ws.userAgent = userAgent;
    ws.connectedAt = Date.now();
    ws.lastPing = Date.now();

    // 更新统计
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    // 存储连接信息
    this.connections.set(ws, {
      connectionId,
      ip: clientIP,
      userAgent,
      connectedAt: ws.connectedAt,
      authenticated: false,
      userId: null,
      token: null
    });

    // 设置WebSocket事件监听器
    this.setupConnectionListeners(ws);

    // 发送连接确认
    this.sendMessage(ws, {
      type: this.messageTypes.CONNECTION_ERROR,
      data: {
        connectionId,
        message: '连接成功，请进行身份验证',
        timestamp: Date.now()
      }
    });

    // 设置认证超时
    const authTimeout = setTimeout(() => {
      const connectionInfo = this.connections.get(ws);
      if (connectionInfo && !connectionInfo.authenticated) {
        logger.warn(`[WebSocket] 连接认证超时: ${connectionId}`);
        this.closeConnection(ws, 1008, '认证超时');
      }
    }, 30000); // 30秒认证超时

    ws.authTimeout = authTimeout;
  }

  /**
   * 设置单个连接的事件监听器
   * @param {WebSocket} ws - WebSocket连接
   * @private
   */
  setupConnectionListeners(ws: WSClient): void {
    ws.on('message', async (data) => {
      try {
        this.stats.messagesReceived++;
        const message = JSON.parse(data.toString());
        await this.handleMessage(ws, message);
      } catch (error) {
        logger.error(`[WebSocket] 消息处理失败: ${ws.connectionId}`, error);
        this.sendError(ws, 'INVALID_MESSAGE', '消息格式错误');
      }
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason);
    });

    ws.on('error', (error) => {
      logger.error(`[WebSocket] 连接错误: ${ws.connectionId}`, error);
      this.handleDisconnection(ws, 1006, '连接错误');
    });

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastPing = Date.now();
    });
  }

  /**
   * 处理消息
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} message - 消息对象
   */
  async handleMessage(ws: WSClient, message: WSMessage): Promise<void> {
    const { type, data, id } = message;

    switch (type) {
      case 'auth':
        await this.handleAuthentication(ws, data, id ?? null);
        break;

      case 'ping':
        this.sendMessage(ws, {
          type: this.messageTypes.PONG,
          data: { timestamp: Date.now() },
          id
        });
        break;

      case 'subscribe':
        await this.handleSubscription(ws, data, id ?? null);
        break;

      case 'unsubscribe':
        await this.handleUnsubscription(ws, data, id ?? null);
        break;

      case 'chat_message':
        await this.handleChatMessage(ws, data, id ?? null);
        break;

      default:
        logger.warn(`[WebSocket] 未知消息类型: ${type}, 连接: ${ws.connectionId}`);
        this.sendError(ws, 'UNKNOWN_MESSAGE_TYPE', '未知消息类型', id);
    }
  }

  /**
   * 处理身份验证
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} data - 验证数据
   * @param {string} messageId - 消息ID
   */
  async handleAuthentication(ws: WSClient, data: unknown, messageId: string | null): Promise<void> {
    try {
      const payload = (data as AuthData) || {};
      const token = typeof payload.token === 'string' ? payload.token : null;

      if (!token) {
        this.sendError(ws, 'MISSING_TOKEN', '缺少认证令牌', messageId);
        return;
      }

      // 验证JWT令牌
      const decoded = tokenService.verifyAccessToken(token);
      if (!decoded) {
        this.stats.authFailures++;
        this.sendError(ws, 'INVALID_TOKEN', '令牌无效', messageId);
        return;
      }

      // 检查Token是否在黑名单中
      const tokenId = typeof decoded.jti === 'string' ? decoded.jti : null;
      if (tokenId && (await tokenService.isTokenBlacklisted(tokenId))) {
        this.stats.authFailures++;
        this.sendError(ws, 'TOKEN_BLACKLISTED', '令牌已失效', messageId);
        return;
      }

      // 更新连接信息
      const connectionInfo = this.connections.get(ws);
      if (connectionInfo) {
        connectionInfo.authenticated = true;
        connectionInfo.userId = decoded.uid;
        connectionInfo.token = token;
        connectionInfo.userInfo = decoded;
      }

      // 添加到用户连接集合
      let userConnections = this.clients.get(decoded.uid);
      if (!userConnections) {
        userConnections = new Set();
        this.clients.set(decoded.uid, userConnections);
      }
      userConnections.add(ws);

      // 清除认证超时
      if (ws.authTimeout) {
        clearTimeout(ws.authTimeout);
        ws.authTimeout = null;
      }

      // 发送认证成功消息
      this.sendMessage(ws, {
        type: this.messageTypes.AUTH_SUCCESS,
        data: {
          userId: decoded.uid,
          permissions: await permissionService.getUserPermissions(decoded.uid),
          timestamp: Date.now()
        },
        id: messageId
      });

      logger.info(`[WebSocket] 用户认证成功: ${decoded.uid}, 连接: ${ws.connectionId}`);
    } catch (error) {
      this.stats.authFailures++;
      logger.error(`[WebSocket] 认证处理失败: ${ws.connectionId}`, error);
      this.sendError(ws, 'AUTH_ERROR', '认证处理失败', messageId);
    }
  }

  /**
   * 处理订阅
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} data - 订阅数据
   * @param {string} messageId - 消息ID
   */
  async handleSubscription(ws: WSClient, data: unknown, messageId: string | null): Promise<void> {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo || !connectionInfo.authenticated) {
      this.sendError(ws, 'NOT_AUTHENTICATED', '请先进行身份验证', messageId);
      return;
    }

    const payload = (data as SubscriptionData) || {};
    const channels = Array.isArray(payload.channels)
      ? payload.channels.filter((channel): channel is string => typeof channel === 'string')
      : [];

    // 初始化订阅列表
    if (!connectionInfo.subscriptions) {
      connectionInfo.subscriptions = new Set<string>();
    }

    const subscriptions = connectionInfo.subscriptions;
    channels.forEach((channel) => {
      subscriptions.add(channel);
    });

    this.sendMessage(ws, {
      type: 'subscription_success',
      data: {
        channels: Array.from(connectionInfo.subscriptions),
        timestamp: Date.now()
      },
      id: messageId
    });

    logger.debug(
      `[WebSocket] 用户订阅: ${connectionInfo.userId}, channels: ${channels.join(', ')}`
    );
  }

  /**
   * 处理取消订阅
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} data - 取消订阅数据
   * @param {string} messageId - 消息ID
   */
  async handleUnsubscription(ws: WSClient, data: unknown, messageId: string | null): Promise<void> {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo || !connectionInfo.authenticated) {
      this.sendError(ws, 'NOT_AUTHENTICATED', '请先进行身份验证', messageId);
      return;
    }

    const payload = (data as UnsubscriptionData) || {};
    const channels = Array.isArray(payload.channels)
      ? payload.channels.filter((channel): channel is string => typeof channel === 'string')
      : [];

    const subscriptions = connectionInfo.subscriptions;
    if (subscriptions) {
      channels.forEach((channel) => {
        subscriptions.delete(channel);
      });
    }

    this.sendMessage(ws, {
      type: 'unsubscription_success',
      data: {
        channels: Array.from(connectionInfo.subscriptions || []),
        timestamp: Date.now()
      },
      id: messageId
    });

    logger.debug(
      `[WebSocket] 用户取消订阅: ${connectionInfo.userId}, channels: ${channels.join(', ')}`
    );
  }

  /**
   * 处理聊天消息
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} data - 聊天数据
   * @param {string} messageId - 消息ID
   */
  async handleChatMessage(ws: WSClient, data: unknown, messageId: string | null): Promise<void> {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo || !connectionInfo.authenticated) {
      this.sendError(ws, 'NOT_AUTHENTICATED', '请先进行身份验证', messageId);
      return;
    }

    const payload = (data as ChatMessageData) || {};
    if (payload.content === undefined) {
      this.sendError(ws, 'INVALID_CHAT_MESSAGE', '缺少聊天内容', messageId);
      return;
    }

    const content = payload.content;
    const messageType = typeof payload.type === 'string' ? payload.type : 'text';
    const targetId =
      typeof payload.targetId === 'string' || payload.targetId === null ? payload.targetId : null;

    const message = {
      id: this.generateMessageId(),
      type: this.messageTypes.CHAT_MESSAGE,
      data: {
        from: connectionInfo.userId,
        content,
        type: messageType,
        targetId,
        timestamp: Date.now()
      }
    };

    // 广播消息
    if (targetId) {
      this.sendToUser(targetId, message);
    } else {
      this.broadcast(message, null, connectionInfo.userId); // 不发送给自己
    }

    // 发送确认
    this.sendMessage(ws, {
      type: 'message_sent',
      data: {
        messageId: message.id,
        timestamp: Date.now()
      },
      id: messageId
    });
  }

  /**
   * 处理连接断开
   * @param {WebSocket} ws - WebSocket连接
   * @param {number} code - 关闭代码
   * @param {string} reason - 关闭原因
   */
  handleDisconnection(ws: WSClient, code: number, reason: string | Buffer): void {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      logger.info(
        `[WebSocket] 连接断开: ${ws.connectionId}, 原因: ${reason || 'unknown'}, 代码: ${code}`
      );

      // 从用户连接集合中移除
      if (connectionInfo.userId) {
        const userConnections = this.clients.get(connectionInfo.userId);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            this.clients.delete(connectionInfo.userId);
          }
        }
      }

      // 清除认证超时
      if (ws.authTimeout) {
        clearTimeout(ws.authTimeout);
      }

      this.connections.delete(ws);
    }

    // 更新统计
    this.stats.activeConnections--;
  }

  /**
   * 处理服务器错误
   * @param {Error} error - 错误对象
   */
  handleServerError(error: unknown): void {
    logger.error('[WebSocket] 服务器错误:', error);
  }

  /**
   * 发送消息到指定用户
   * @param {string} userId - 用户ID
   * @param {Object} message - 消息对象
   * @returns {number} 发送数量
   */
  sendToUser(userId: string | null, message: WSMessage): number {
    if (!userId) {
      return 0;
    }
    const userConnections = this.clients.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return 0;
    }

    let sentCount = 0;
    userConnections.forEach((ws) => {
      if (ws.readyState === WSClient.OPEN) {
        this.sendMessage(ws, message);
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * 广播消息
   * @param {Object} message - 消息对象
   * @param {string} channel - 频道（可选）
   * @param {string} excludeUserId - 排除的用户ID（可选）
   * @returns {number} 发送数量
   */
  broadcast(
    message: WSMessage,
    channel: string | null = null,
    excludeUserId: string | null = null
  ): number {
    let sentCount = 0;

    this.connections.forEach((connectionInfo, ws) => {
      // 检查连接状态
      if (ws.readyState !== WSClient.OPEN) {
        return;
      }

      // 检查认证状态
      if (!connectionInfo.authenticated) {
        return;
      }

      // 检查排除用户
      if (excludeUserId && connectionInfo.userId === excludeUserId) {
        return;
      }

      // 检查频道订阅
      if (channel && connectionInfo.subscriptions && !connectionInfo.subscriptions.has(channel)) {
        return;
      }

      this.sendMessage(ws, message);
      sentCount++;
    });

    return sentCount;
  }

  /**
   * 发送消息到连接
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} message - 消息对象
   */
  sendMessage(ws: WSClient, message: WSMessage): void {
    if (ws.readyState === WSClient.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        this.stats.messagesSent++;
      } catch (error) {
        logger.error(`[WebSocket] 发送消息失败: ${ws.connectionId}`, error);
      }
    }
  }

  /**
   * 发送错误消息
   * @param {WebSocket} ws - WebSocket连接
   * @param {string} code - 错误代码
   * @param {string} message - 错误消息
   * @param {string} messageId - 原消息ID
   */
  sendError(ws: WSClient, code: string, message: string, messageId: string | null = null): void {
    this.sendMessage(ws, {
      type: 'error',
      data: {
        code,
        message,
        timestamp: Date.now()
      },
      id: messageId
    });
  }

  /**
   * 关闭连接
   * @param {WebSocket} ws - WebSocket连接
   * @param {number} code - 关闭代码
   * @param {string} reason - 关闭原因
   */
  closeConnection(ws: WSClient, code: number = 1000, reason: string = 'Normal closure'): void {
    if (ws.readyState === WSClient.OPEN) {
      ws.close(code, reason);
    }
  }

  /**
   * 任务进度推送
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID
   * @param {Object} progressData - 进度数据
   */
  pushTaskProgress(userId: string, taskId: string, progressData: unknown): number {
    const normalizedProgress = this.normalizePayload(progressData);
    const message = {
      type: this.messageTypes.TASK_PROGRESS,
      data: {
        taskId,
        ...normalizedProgress,
        timestamp: Date.now()
      }
    };

    const sentCount = this.sendToUser(userId, message);
    logger.debug(`[WebSocket] 任务进度推送: userId=${userId}, taskId=${taskId}, sent=${sentCount}`);

    return sentCount;
  }

  /**
   * 任务状态变更推送
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID
   * @param {string} status - 新状态
   * @param {Object} extraData - 额外数据
   */
  pushTaskStatusChange(
    userId: string,
    taskId: string,
    status: string,
    extraData: unknown = {}
  ): number {
    const normalizedExtra = this.normalizePayload(extraData);
    const message = {
      type: this.messageTypes.TASK_STATUS_CHANGED,
      data: {
        taskId,
        status,
        ...normalizedExtra,
        timestamp: Date.now()
      }
    };

    const sentCount = this.sendToUser(userId, message);
    logger.info(
      `[WebSocket] 任务状态推送: userId=${userId}, taskId=${taskId}, status=${status}, sent=${sentCount}`
    );

    return sentCount;
  }

  /**
   * 系统通知推送
   * @param {string} userId - 用户ID
   * @param {Object} notification - 通知数据
   */
  pushNotification(userId: string, notification: unknown): number {
    const normalizedNotification = this.normalizePayload(notification);
    const message = {
      type: this.messageTypes.USER_NOTIFICATION,
      data: {
        ...normalizedNotification,
        timestamp: Date.now()
      }
    };

    const sentCount = this.sendToUser(userId, message);
    logger.info(`[WebSocket] 通知推送: userId=${userId}, sent=${sentCount}`);

    return sentCount;
  }

  /**
   * 系统维护通知
   * @param {Object} maintenanceData - 维护数据
   */
  pushMaintenanceAlert(maintenanceData: unknown): number {
    const normalizedMaintenance = this.normalizePayload(maintenanceData);
    const message = {
      type: this.messageTypes.MAINTENANCE_ALERT,
      data: {
        ...normalizedMaintenance,
        timestamp: Date.now()
      }
    };

    const sentCount = this.broadcast(message, 'system');
    logger.info(`[WebSocket] 维护通知推送: sent=${sentCount}`);

    return sentCount;
  }

  /**
   * 启动心跳检查
   * @private
   */
  startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      const server = this.wss;
      if (!server) {
        return;
      }
      server.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.warn(`[WebSocket] 心跳超时，断开连接: ${ws.connectionId}`);
          this.closeConnection(ws, 1000, '心跳超时');
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, this.config.heartbeatInterval);

    logger.info(`[WebSocket] 心跳检查已启动，间隔: ${this.config.heartbeatInterval}ms`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats(): unknown {
    const now = Date.now();
    const uptime = now - this.stats.lastReset;

    return {
      ...this.stats,
      uptime,
      activeConnections: this.stats.activeConnections,
      totalUsers: this.clients.size,
      connectionsPerUser:
        this.stats.activeConnections > 0
          ? (this.stats.activeConnections / this.clients.size).toFixed(2)
          : 0,
      messageRate:
        uptime > 0
          ? (((this.stats.messagesSent + this.stats.messagesReceived) / uptime) * 1000).toFixed(2)
          : 0,
      authSuccessRate:
        this.stats.totalConnections > 0
          ? (
              ((this.stats.totalConnections - this.stats.authFailures) /
                this.stats.totalConnections) *
              100
            ).toFixed(2) + '%'
          : '0%',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成连接ID
   * @returns {string} 连接ID
   * @private
   */
  generateConnectionId(): string {
    return require('crypto').randomBytes(16).toString('hex');
  }

  /**
   * 生成消息ID
   * @returns {string} 消息ID
   * @private
   */
  generateMessageId(): string {
    return require('crypto').randomBytes(12).toString('hex');
  }

  /**
   * 关闭WebSocket服务
   */
  async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.wss) {
      // 关闭所有连接
      this.wss.clients.forEach((ws) => {
        this.closeConnection(ws, 1001, '服务器关闭');
      });

      // 关闭服务器
      this.wss.close();
      this.wss = null;

      logger.info('[WebSocket] 服务已关闭');
    }

    this.initialized = false;
  }

  private normalizePayload(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
    return {};
  }
}

const websocketService = new WebSocketService();

export default websocketService;
