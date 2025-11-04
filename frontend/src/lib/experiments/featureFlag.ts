/**
 * Feature Flag & A/B 实验 SDK
 * 艹！这个SDK用于管理特性开关和A/B测试！
 *
 * 功能：
 * 1. Feature Flag（特性开关）
 * 2. A/B Testing（A/B测试）
 * 3. 用户分组（按用户ID哈希分组）
 * 4. 实验数据追踪
 *
 * @author 老王
 */

/**
 * 实验配置
 */
export interface ExperimentConfig {
  id: string; // 实验ID
  name: string; // 实验名称
  description: string; // 实验描述
  status: 'draft' | 'running' | 'paused' | 'completed'; // 实验状态
  variants: ExperimentVariant[]; // 实验变体
  traffic_allocation: number; // 流量分配（0-100）
  start_date?: string; // 开始时间
  end_date?: string; // 结束时间
  created_at: string;
  updated_at: string;
}

/**
 * 实验变体
 */
export interface ExperimentVariant {
  id: string; // 变体ID
  name: string; // 变体名称
  weight: number; // 权重（0-100）
  config: Record<string, any>; // 变体配置
}

/**
 * 实验曝光事件
 */
export interface ExperimentExposure {
  experiment_id: string;
  variant_id: string;
  user_id?: string;
  session_id: string;
  timestamp: number;
}

/**
 * 实验转化事件
 */
export interface ExperimentConversion {
  experiment_id: string;
  variant_id: string;
  user_id?: string;
  session_id: string;
  event_name: string; // 转化事件名称
  event_value?: number; // 转化事件值
  timestamp: number;
}

/**
 * Feature Flag & A/B 实验管理器
 * 艹！这个SB类负责管理所有实验和特性开关！
 */
class ExperimentManager {
  private experiments: Map<string, ExperimentConfig> = new Map();
  private userAssignments: Map<string, Map<string, string>> = new Map(); // experimentId -> userId -> variantId
  private sessionId: string;
  private userId?: string;
  private exposures: ExperimentExposure[] = [];
  private conversions: ExperimentConversion[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * 初始化实验配置
   */
  async init() {
    try {
      const response = await fetch('/api/experiments/config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取实验配置失败: ${response.status}`);
      }

      const data = await response.json();

      // 加载实验配置
      data.experiments.forEach((exp: ExperimentConfig) => {
        this.experiments.set(exp.id, exp);
      });

      console.log('[A/B实验] 初始化完成，加载', this.experiments.size, '个实验');
    } catch (error) {
      console.error('[A/B实验] 初始化失败:', error);
    }
  }

  /**
   * 获取实验变体（自动分配）
   *
   * @param experimentId 实验ID
   * @returns 变体ID
   */
  getVariant(experimentId: string): string | null {
    const experiment = this.experiments.get(experimentId);

    if (!experiment) {
      console.warn(`[A/B实验] 实验不存在: ${experimentId}`);
      return null;
    }

    // 实验未运行
    if (experiment.status !== 'running') {
      console.warn(`[A/B实验] 实验未运行: ${experimentId}, 状态: ${experiment.status}`);
      return null;
    }

    // 检查用户是否已分配变体
    const userId = this.userId || this.sessionId;
    let userAssignments = this.userAssignments.get(experimentId);

    if (!userAssignments) {
      userAssignments = new Map();
      this.userAssignments.set(experimentId, userAssignments);
    }

    if (userAssignments.has(userId)) {
      const variantId = userAssignments.get(userId)!;
      this.trackExposure(experimentId, variantId);
      return variantId;
    }

    // 流量分配检查
    const inExperiment = this.isInExperiment(userId, experiment.traffic_allocation);

    if (!inExperiment) {
      console.log(`[A/B实验] 用户不在实验流量中: ${experimentId}`);
      return null;
    }

    // 按权重分配变体
    const variantId = this.assignVariant(userId, experiment.variants);
    userAssignments.set(userId, variantId);

    // 记录曝光
    this.trackExposure(experimentId, variantId);

    return variantId;
  }

  /**
   * 检查用户是否在实验流量中
   *
   * @param userId 用户ID
   * @param trafficAllocation 流量分配比例（0-100）
   * @returns 是否在实验流量中
   */
  private isInExperiment(userId: string, trafficAllocation: number): boolean {
    const hash = this.hashString(userId);
    const bucket = hash % 100;
    return bucket < trafficAllocation;
  }

  /**
   * 分配实验变体
   *
   * @param userId 用户ID
   * @param variants 变体列表
   * @returns 变体ID
   */
  private assignVariant(userId: string, variants: ExperimentVariant[]): string {
    const hash = this.hashString(userId + '_variant');
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    const bucket = hash % totalWeight;

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variant.id;
      }
    }

    // 默认返回第一个变体
    return variants[0].id;
  }

  /**
   * 字符串哈希（简单实现）
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 记录实验曝光
   */
  private trackExposure(experimentId: string, variantId: string) {
    const exposure: ExperimentExposure = {
      experiment_id: experimentId,
      variant_id: variantId,
      user_id: this.userId,
      session_id: this.sessionId,
      timestamp: Date.now(),
    };

    this.exposures.push(exposure);

    // 发送到后端（批量）
    if (this.exposures.length >= 10) {
      this.flushExposures();
    }
  }

  /**
   * 记录实验转化
   */
  trackConversion(
    experimentId: string,
    eventName: string,
    eventValue?: number
  ) {
    const variantId = this.getVariant(experimentId);

    if (!variantId) {
      console.warn(`[A/B实验] 无法记录转化，实验未分配变体: ${experimentId}`);
      return;
    }

    const conversion: ExperimentConversion = {
      experiment_id: experimentId,
      variant_id: variantId,
      user_id: this.userId,
      session_id: this.sessionId,
      event_name: eventName,
      event_value: eventValue,
      timestamp: Date.now(),
    };

    this.conversions.push(conversion);

    // 发送到后端（批量）
    if (this.conversions.length >= 10) {
      this.flushConversions();
    }
  }

  /**
   * 上报曝光数据
   */
  private async flushExposures() {
    if (this.exposures.length === 0) return;

    const exposuresToSend = [...this.exposures];
    this.exposures = [];

    try {
      await fetch('/api/experiments/exposures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exposures: exposuresToSend,
        }),
      });

      console.log(`[A/B实验] 上报 ${exposuresToSend.length} 条曝光数据`);
    } catch (error) {
      console.error('[A/B实验] 上报曝光数据失败:', error);
      // 失败时重新加入队列
      this.exposures = [...exposuresToSend.slice(-100), ...this.exposures];
    }
  }

  /**
   * 上报转化数据
   */
  private async flushConversions() {
    if (this.conversions.length === 0) return;

    const conversionsToSend = [...this.conversions];
    this.conversions = [];

    try {
      await fetch('/api/experiments/conversions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversions: conversionsToSend,
        }),
      });

      console.log(`[A/B实验] 上报 ${conversionsToSend.length} 条转化数据`);
    } catch (error) {
      console.error('[A/B实验] 上报转化数据失败:', error);
      // 失败时重新加入队列
      this.conversions = [...conversionsToSend.slice(-100), ...this.conversions];
    }
  }

  /**
   * 手动上报所有数据
   */
  async flush() {
    await Promise.all([this.flushExposures(), this.flushConversions()]);
  }

  /**
   * Feature Flag 检查
   *
   * @param flagKey Feature Flag Key
   * @returns 是否开启
   */
  isFeatureEnabled(flagKey: string): boolean {
    // 简化实现：检查实验是否存在且运行中
    const experiment = this.experiments.get(flagKey);
    return experiment?.status === 'running';
  }

  /**
   * 获取实验配置值
   *
   * @param experimentId 实验ID
   * @param configKey 配置Key
   * @param defaultValue 默认值
   * @returns 配置值
   */
  getConfig<T = any>(experimentId: string, configKey: string, defaultValue: T): T {
    const variantId = this.getVariant(experimentId);

    if (!variantId) {
      return defaultValue;
    }

    const experiment = this.experiments.get(experimentId);
    const variant = experiment?.variants.find((v) => v.id === variantId);

    if (!variant || !variant.config) {
      return defaultValue;
    }

    return variant.config[configKey] ?? defaultValue;
  }
}

// 导出单例
export const experimentManager = new ExperimentManager();

// 自动初始化（仅在浏览器环境）
if (typeof window !== 'undefined') {
  experimentManager.init();

  // 页面卸载时上报数据
  window.addEventListener('beforeunload', () => {
    experimentManager.flush();
  });
}
