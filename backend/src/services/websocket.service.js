const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * WebSocket服务 (P1-011)
 * 艹！用Socket.IO实现任务状态实时推送，不用再让用户傻傻地刷新页面了
 *
 * 功能:
 * - 用户连接认证 (JWT)
 * - 用户加入个人任务房间
 * - 任务状态变更推送
 * - 任务进度推送
 * - 在线状态管理
 */
class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set<socketId>
  }

  /**
   * 初始化Socket.IO服务器
   * 艹！绑定到HTTP服务器上，支持CORS
   *
   * @param {Object} server - HTTP服务器实例
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://aizhao.icu', 'https://www.aizhao.icu']
          : '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    // Socket.IO中间件 - JWT认证
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('认证失败: 缺少token'));
        }

        // 验证JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userPhone = decoded.phone;

        logger.info(`[WebSocket] 用户连接: userId=${socket.userId}, socketId=${socket.id}`);
        next();
      } catch (error) {
        logger.error(`[WebSocket] 认证失败: ${error.message}`);
        next(new Error('认证失败: token无效'));
      }
    });

    // 连接事件
    this.io.on('connection', (socket) => {
      this._handleConnection(socket);
    });

    logger.info('[WebSocket] Socket.IO服务器已启动');
  }

  /**
   * 处理用户连接
   * 艹！用户连接后自动加入个人房间，方便单独推送消息
   *
   * @private
   * @param {Object} socket - Socket实例
   */
  _handleConnection(socket) {
    const { userId } = socket;

    // 加入个人房间
    const userRoom = `user:${userId}`;
    socket.join(userRoom);

    // 记录用户Socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);

    logger.info(`[WebSocket] 用户加入房间: userId=${userId}, room=${userRoom}, 在线连接数=${this.userSockets.get(userId).size}`);

    // 发送欢迎消息
    socket.emit('connected', {
      message: '连接成功',
      userId,
      timestamp: new Date().toISOString()
    });

    // 处理断开连接
    socket.on('disconnect', () => {
      this._handleDisconnect(socket);
    });

    // 处理心跳
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // 处理订阅任务
    socket.on('subscribe:task', (taskId) => {
      this._handleSubscribeTask(socket, taskId);
    });

    // 处理取消订阅
    socket.on('unsubscribe:task', (taskId) => {
      this._handleUnsubscribeTask(socket, taskId);
    });
  }

  /**
   * 处理用户断开连接
   * 艹！清理用户的Socket记录
   *
   * @private
   * @param {Object} socket - Socket实例
   */
  _handleDisconnect(socket) {
    const { userId } = socket;

    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socket.id);

      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
        logger.info(`[WebSocket] 用户离线: userId=${userId}`);
      } else {
        logger.info(`[WebSocket] 用户连接断开: userId=${userId}, 剩余连接数=${this.userSockets.get(userId).size}`);
      }
    }
  }

  /**
   * 处理订阅任务
   * 艹！用户可以订阅特定任务，接收该任务的所有更新
   *
   * @private
   * @param {Object} socket - Socket实例
   * @param {number} taskId - 任务ID
   */
  _handleSubscribeTask(socket, taskId) {
    const taskRoom = `task:${taskId}`;
    socket.join(taskRoom);
    logger.info(`[WebSocket] 用户订阅任务: userId=${socket.userId}, taskId=${taskId}`);

    socket.emit('subscribed', {
      taskId,
      message: `已订阅任务 ${taskId}`
    });
  }

  /**
   * 处理取消订阅任务
   * 艹！用户离开任务详情页时取消订阅
   *
   * @private
   * @param {Object} socket - Socket实例
   * @param {number} taskId - 任务ID
   */
  _handleUnsubscribeTask(socket, taskId) {
    const taskRoom = `task:${taskId}`;
    socket.leave(taskRoom);
    logger.info(`[WebSocket] 用户取消订阅任务: userId=${socket.userId}, taskId=${taskId}`);

    socket.emit('unsubscribed', {
      taskId,
      message: `已取消订阅任务 ${taskId}`
    });
  }

  /**
   * 推送任务状态变更
   * 艹！任务状态变更时通知用户
   *
   * @param {number} userId - 用户ID
   * @param {number} taskId - 任务ID
   * @param {Object} data - 任务数据
   */
  pushTaskStatus(userId, taskId, data) {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO未初始化，无法推送消息');
      return;
    }

    const userRoom = `user:${userId}`;
    const taskRoom = `task:${taskId}`;

    const message = {
      event: 'task:status',
      taskId,
      status: data.status,
      data,
      timestamp: new Date().toISOString()
    };

    // 推送到用户房间
    this.io.to(userRoom).emit('task:status', message);

    // 推送到任务房间（如果有订阅者）
    this.io.to(taskRoom).emit('task:status', message);

    logger.info(`[WebSocket] 推送任务状态: userId=${userId}, taskId=${taskId}, status=${data.status}`);
  }

  /**
   * 推送任务进度
   * 艹！任务处理过程中推送进度百分比
   *
   * @param {number} userId - 用户ID
   * @param {number} taskId - 任务ID
   * @param {Object} progress - 进度数据
   */
  pushTaskProgress(userId, taskId, progress) {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO未初始化，无法推送消息');
      return;
    }

    const userRoom = `user:${userId}`;
    const taskRoom = `task:${taskId}`;

    const message = {
      event: 'task:progress',
      taskId,
      progress,
      timestamp: new Date().toISOString()
    };

    // 推送到用户房间
    this.io.to(userRoom).emit('task:progress', message);

    // 推送到任务房间（如果有订阅者）
    this.io.to(taskRoom).emit('task:progress', message);

    logger.debug(`[WebSocket] 推送任务进度: userId=${userId}, taskId=${taskId}, progress=${progress.percentage}%`);
  }

  /**
   * 推送任务错误
   * 艹！任务失败时通知用户
   *
   * @param {number} userId - 用户ID
   * @param {number} taskId - 任务ID
   * @param {Object} error - 错误信息
   */
  pushTaskError(userId, taskId, error) {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO未初始化，无法推送消息');
      return;
    }

    const userRoom = `user:${userId}`;
    const taskRoom = `task:${taskId}`;

    const message = {
      event: 'task:error',
      taskId,
      error: {
        message: error.message || '任务处理失败',
        code: error.code || 'TASK_ERROR'
      },
      timestamp: new Date().toISOString()
    };

    // 推送到用户房间
    this.io.to(userRoom).emit('task:error', message);

    // 推送到任务房间（如果有订阅者）
    this.io.to(taskRoom).emit('task:error', message);

    logger.error(`[WebSocket] 推送任务错误: userId=${userId}, taskId=${taskId}, error=${error.message}`);
  }

  /**
   * 推送任务完成
   * 艹！任务完成时通知用户，附带结果数据
   *
   * @param {number} userId - 用户ID
   * @param {number} taskId - 任务ID
   * @param {Object} result - 任务结果
   */
  pushTaskCompleted(userId, taskId, result) {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO未初始化，无法推送消息');
      return;
    }

    const userRoom = `user:${userId}`;
    const taskRoom = `task:${taskId}`;

    const message = {
      event: 'task:completed',
      taskId,
      result,
      timestamp: new Date().toISOString()
    };

    // 推送到用户房间
    this.io.to(userRoom).emit('task:completed', message);

    // 推送到任务房间（如果有订阅者）
    this.io.to(taskRoom).emit('task:completed', message);

    logger.info(`[WebSocket] 推送任务完成: userId=${userId}, taskId=${taskId}`);
  }

  /**
   * 广播系统消息
   * 艹！向所有在线用户广播系统通知
   *
   * @param {Object} message - 系统消息
   */
  broadcastSystemMessage(message) {
    if (!this.io) {
      logger.warn('[WebSocket] Socket.IO未初始化，无法推送消息');
      return;
    }

    this.io.emit('system:message', {
      event: 'system:message',
      message,
      timestamp: new Date().toISOString()
    });

    logger.info(`[WebSocket] 广播系统消息: ${message.title || message.content}`);
  }

  /**
   * 获取在线用户数
   *
   * @returns {number} 在线用户数
   */
  getOnlineUserCount() {
    return this.userSockets.size;
  }

  /**
   * 获取用户在线状态
   *
   * @param {number} userId - 用户ID
   * @returns {boolean} 是否在线
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }

  /**
   * 获取服务状态
   *
   * @returns {Object} 服务状态
   */
  getStatus() {
    return {
      initialized: this.io !== null,
      onlineUsers: this.getOnlineUserCount(),
      totalConnections: Array.from(this.userSockets.values()).reduce((sum, sockets) => sum + sockets.size, 0)
    };
  }
}

module.exports = new WebSocketService();
