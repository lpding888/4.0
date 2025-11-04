/**
 * 审计日志追踪系统
 * 艹！这个系统记录所有关键操作，批量上报！
 *
 * @author 老王
 */

/**
 * 事件类型
 */
export type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'template.create'
  | 'template.update'
  | 'template.delete'
  | 'template.export'
  | 'prompt.create'
  | 'prompt.update'
  | 'prompt.delete'
  | 'model.create'
  | 'model.update'
  | 'model.delete'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'billing.purchase'
  | 'billing.refund'
  | 'config.update'
  | 'tenant.create'
  | 'tenant.update'
  | 'tenant.delete'
  | 'tenant.switch'
  | 'permission.grant'
  | 'permission.revoke'
  | 'data.export'
  | 'data.import';

/**
 * 审计事件
 */
export interface AuditEvent {
  id?: string; // 事件ID（服务端生成）
  event_type: AuditEventType; // 事件类型
  user_id?: string; // 操作用户ID
  user_email?: string; // 操作用户邮箱
  tenant_id?: string; // 租户ID
  resource_type?: string; // 资源类型
  resource_id?: string; // 资源ID
  action: string; // 操作动作
  details?: Record<string, any>; // 详细信息
  ip_address?: string; // IP地址
  user_agent?: string; // 浏览器UA
  timestamp: number; // 时间戳（毫秒）
  status: 'success' | 'failure' | 'pending'; // 操作状态
  error_message?: string; // 错误信息（如果失败）
}

/**
 * 审计追踪器配置
 */
interface AuditTrackerConfig {
  batchSize: number; // 批量上报大小
  flushInterval: number; // 上报间隔（毫秒）
  maxQueueSize: number; // 最大队列大小
  endpoint: string; // 上报接口
  enabled: boolean; // 是否启用
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AuditTrackerConfig = {
  batchSize: 10, // 每10条上报一次
  flushInterval: 30000, // 30秒上报一次
  maxQueueSize: 100, // 最多缓存100条
  endpoint: '/api/admin/audit/batch', // 批量上报接口
  enabled: true, // 默认启用
};

/**
 * 审计追踪器类
 */
class AuditTracker {
  private config: AuditTrackerConfig;
  private queue: AuditEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isSending = false;

  constructor(config: Partial<AuditTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 启动定时上报
    if (this.config.enabled) {
      this.startTimer();
    }

    // 页面关闭前上报剩余事件
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush(true); // 同步上报
      });
    }
  }

  /**
   * 追踪事件
   *
   * @param eventType 事件类型
   * @param data 事件数据
   */
  track(eventType: AuditEventType, data: Partial<AuditEvent> = {}): void {
    if (!this.config.enabled) return;

    // 构建事件对象
    const event: AuditEvent = {
      event_type: eventType,
      action: data.action || eventType,
      timestamp: Date.now(),
      status: data.status || 'success',
      ...data,
    };

    // 自动获取用户信息（从localStorage）
    if (typeof window !== 'undefined') {
      try {
        // 从auth store读取用户信息
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const { state } = JSON.parse(authStorage);
          const user = state?.user;
          if (user) {
            event.user_id = event.user_id || user.id;
            event.user_email = event.user_email || user.email;
          }
        }

        // 从tenant store读取租户信息
        const tenantStorage = localStorage.getItem('tenant-storage');
        if (tenantStorage) {
          const { state } = JSON.parse(tenantStorage);
          const activeTenant = state?.activeTenant;
          if (activeTenant) {
            event.tenant_id = event.tenant_id || activeTenant.id;
          }
        }

        // 获取IP和UA（浏览器环境）
        event.user_agent = event.user_agent || navigator.userAgent;
        // IP地址需要服务端获取，这里不设置
      } catch (error) {
        console.warn('[Audit] 读取用户信息失败:', error);
      }
    }

    // 添加到队列
    this.addToQueue(event);
  }

  /**
   * 添加事件到队列
   */
  private addToQueue(event: AuditEvent): void {
    // 检查队列大小
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('[Audit] 队列已满，丢弃最早的事件');
      this.queue.shift();
    }

    this.queue.push(event);

    // 检查是否需要立即上报
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * 上报事件
   *
   * @param sync 是否同步上报（页面关闭时使用）
   */
  async flush(sync = false): Promise<void> {
    if (this.queue.length === 0 || this.isSending) return;

    const events = [...this.queue];
    this.queue = [];
    this.isSending = true;

    try {
      if (sync && typeof navigator.sendBeacon !== 'undefined') {
        // 使用sendBeacon同步发送（页面关闭时）
        const blob = new Blob([JSON.stringify({ events })], {
          type: 'application/json',
        });
        navigator.sendBeacon(this.config.endpoint, blob);
      } else {
        // 异步发送
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ events }),
        });

        if (!response.ok) {
          throw new Error(`上报失败: ${response.status}`);
        }

        console.log(`[Audit] 成功上报 ${events.length} 条事件`);
      }
    } catch (error) {
      console.error('[Audit] 上报失败:', error);
      // 失败时重新加入队列
      this.queue.unshift(...events);
    } finally {
      this.isSending = false;
    }
  }

  /**
   * 启动定时器
   */
  private startTimer(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * 停止定时器
   */
  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 启用追踪
   */
  enable(): void {
    this.config.enabled = true;
    this.startTimer();
  }

  /**
   * 禁用追踪
   */
  disable(): void {
    this.config.enabled = false;
    this.stopTimer();
    this.flush(); // 禁用前上报剩余事件
  }

  /**
   * 获取队列状态
   */
  getStatus(): { queueSize: number; enabled: boolean } {
    return {
      queueSize: this.queue.length,
      enabled: this.config.enabled,
    };
  }
}

/**
 * 全局审计追踪器实例
 */
const auditTracker = new AuditTracker();

/**
 * 导出追踪函数
 */
export const audit = {
  /**
   * 追踪事件
   */
  track: (eventType: AuditEventType, data?: Partial<AuditEvent>) => {
    auditTracker.track(eventType, data);
  },

  /**
   * 立即上报所有事件
   */
  flush: () => {
    return auditTracker.flush();
  },

  /**
   * 启用追踪
   */
  enable: () => {
    auditTracker.enable();
  },

  /**
   * 禁用追踪
   */
  disable: () => {
    auditTracker.disable();
  },

  /**
   * 获取状态
   */
  getStatus: () => {
    return auditTracker.getStatus();
  },
};

/**
 * 便捷追踪函数
 */
export const trackEvent = audit.track;
