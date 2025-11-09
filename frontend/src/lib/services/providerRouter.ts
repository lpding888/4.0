/**
 * Provider路由策略服务
 * 艹！智能路由选择Provider，支持降级重试和成本优化！
 *
 * 核心功能：
 * 1. 基于权重的加权随机选择
 * 2. 质量档位降级重试（high → medium → low）
 * 3. 成本统计和报表
 *
 * @author 老王
 */

import { Provider, QualityTier, adminProviders } from './adminProviders';
import { logger } from '@/lib/monitoring/logger';

/**
 * Provider选择结果
 */
export interface ProviderSelectionResult {
  provider: Provider;
  tier: QualityTier;
  attemptNumber: number; // 第几次尝试（1=首次，2=降级重试）
}

/**
 * Provider调用记录（用于成本统计）
 */
export interface ProviderUsageRecord {
  provider_ref: string;
  provider_name: string;
  quality_tier: QualityTier;
  tokens_used: number;
  cost: number; // 美元
  timestamp: string;
  request_id?: string;
  success: boolean;
  error_message?: string;
}

/**
 * 成本报表统计
 */
export interface CostReport {
  total_cost: number; // 总成本（美元）
  total_tokens: number; // 总Token数
  provider_breakdown: Array<{
    provider_ref: string;
    provider_name: string;
    quality_tier: QualityTier;
    cost: number;
    tokens: number;
    call_count: number;
    success_rate: number; // 成功率（0-1）
  }>;
  tier_breakdown: Array<{
    tier: QualityTier;
    cost: number;
    tokens: number;
    call_count: number;
  }>;
  time_range: {
    start: string;
    end: string;
  };
}

/**
 * Provider路由器
 * 艹！这个SB类负责Provider的智能路由和降级策略！
 */
class ProviderRouter {
  private usageRecords: ProviderUsageRecord[] = [];
  private maxRecordsInMemory = 10000; // 内存中最多保留1万条记录

  /**
   * 选择Provider（带降级重试）
   *
   * @param qualityTier 期望的质量档位
   * @param attemptNumber 尝试次数（用于降级）
   * @returns Provider选择结果
   */
  async selectProvider(
    qualityTier: QualityTier = 'high',
    attemptNumber: number = 1
  ): Promise<ProviderSelectionResult> {
    // 根据尝试次数决定实际档位（降级逻辑）
    let actualTier = qualityTier;

    if (attemptNumber === 2) {
      // 第二次尝试：降级
      actualTier = qualityTier === 'high' ? 'medium' : 'low';
    } else if (attemptNumber >= 3) {
      // 第三次尝试：最低档
      actualTier = 'low';
    }

    logger.info(`选择Provider: 期望档位=${qualityTier}, 实际档位=${actualTier}, 尝试次数=${attemptNumber}`, {
      action: 'provider_selection',
    });

    // 获取该档位的所有可用Provider
    const providers = await this.getAvailableProviders(actualTier);

    if (providers.length === 0) {
      throw new Error(`没有可用的Provider (档位: ${actualTier})`);
    }

    // 基于权重选择
    const selectedProvider = this.weightedRandomSelect(providers);

    logger.info(`Provider选择成功: ${selectedProvider.provider_name} (${selectedProvider.provider_ref})`, {
      action: 'provider_selected',
    });

    return {
      provider: selectedProvider,
      tier: actualTier,
      attemptNumber,
    };
  }

  /**
   * 获取指定档位的可用Provider列表
   */
  private async getAvailableProviders(tier: QualityTier): Promise<Provider[]> {
    try {
      const response = await adminProviders.list({ limit: 500 });

      // 过滤：quality_tier匹配 && enabled=true
      const filtered = response.items.filter(
        (p) =>
          p.quality_tier === tier &&
          (p.enabled === undefined || p.enabled === true) &&
          p.weight !== undefined &&
          p.weight > 0
      );

      return filtered;
    } catch (error: any) {
      logger.error('获取Provider列表失败', error, {
        action: 'get_providers',
      });
      throw error;
    }
  }

  /**
   * 基于权重的随机选择
   * 艹！加权随机算法，权重越高，被选中概率越大！
   */
  private weightedRandomSelect(providers: Provider[]): Provider {
    // 计算总权重
    const totalWeight = providers.reduce((sum, p) => sum + (p.weight || 1), 0);

    // 生成随机数 [0, totalWeight)
    let random = Math.random() * totalWeight;

    // 累加权重，直到超过随机数
    for (const provider of providers) {
      random -= provider.weight || 1;
      if (random <= 0) {
        return provider;
      }
    }

    // 兜底：返回第一个
    if (!providers[0]) {
      throw new Error('加权选择失败: Provider列表为空');
    }
    return providers[0];
  }

  /**
   * 记录Provider使用情况
   *
   * @param record 使用记录
   */
  recordUsage(record: ProviderUsageRecord) {
    // 添加到内存记录
    this.usageRecords.push(record);

    // 限制内存大小（FIFO）
    if (this.usageRecords.length > this.maxRecordsInMemory) {
      this.usageRecords.shift();
    }

    // 记录到日志（用于持久化）
    logger.info(`Provider使用记录: ${record.provider_name}`, {
      action: 'provider_usage',
    }, {
      provider_ref: record.provider_ref,
      quality_tier: record.quality_tier,
      tokens_used: record.tokens_used,
      cost: record.cost,
      success: record.success,
    });

    // TODO: 异步持久化到后端（可选）
    // this.persistUsageRecord(record);
  }

  /**
   * 生成成本报表
   *
   * @param startDate 开始日期（ISO 8601）
   * @param endDate 结束日期（ISO 8601）
   * @returns 成本报表
   */
  generateCostReport(startDate?: string, endDate?: string): CostReport {
    let records = this.usageRecords;

    // 时间范围过滤
    if (startDate || endDate) {
      records = records.filter((r) => {
        const timestamp = new Date(r.timestamp).getTime();
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() : Date.now();
        return timestamp >= start && timestamp <= end;
      });
    }

    // 按Provider聚合
    const providerMap = new Map<string, {
      provider_ref: string;
      provider_name: string;
      quality_tier: QualityTier;
      cost: number;
      tokens: number;
      call_count: number;
      success_count: number;
    }>();

    records.forEach((r) => {
      const key = `${r.provider_ref}_${r.quality_tier}`;
      const existing = providerMap.get(key) || {
        provider_ref: r.provider_ref,
        provider_name: r.provider_name,
        quality_tier: r.quality_tier,
        cost: 0,
        tokens: 0,
        call_count: 0,
        success_count: 0,
      };

      existing.cost += r.cost;
      existing.tokens += r.tokens_used;
      existing.call_count += 1;
      if (r.success) {
        existing.success_count += 1;
      }

      providerMap.set(key, existing);
    });

    const providerBreakdown = Array.from(providerMap.values()).map((p) => ({
      ...p,
      success_rate: p.call_count > 0 ? p.success_count / p.call_count : 0,
    }));

    // 按档位聚合
    const tierMap = new Map<QualityTier, { cost: number; tokens: number; call_count: number }>();

    records.forEach((r) => {
      const existing = tierMap.get(r.quality_tier) || { cost: 0, tokens: 0, call_count: 0 };
      existing.cost += r.cost;
      existing.tokens += r.tokens_used;
      existing.call_count += 1;
      tierMap.set(r.quality_tier, existing);
    });

    const tierBreakdown = Array.from(tierMap.entries()).map(([tier, data]) => ({
      tier,
      ...data,
    }));

    // 计算总计
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const totalTokens = records.reduce((sum, r) => sum + r.tokens_used, 0);

    return {
      total_cost: totalCost,
      total_tokens: totalTokens,
      provider_breakdown: providerBreakdown,
      tier_breakdown: tierBreakdown,
      time_range: {
        start: startDate || (records[0]?.timestamp || new Date().toISOString()),
        end: endDate || new Date().toISOString(),
      },
    };
  }

  /**
   * 导出成本报表为CSV
   */
  exportCostReportCSV(report: CostReport): string {
    const lines: string[] = [];

    // 标题
    lines.push('# Provider成本报表');
    lines.push(`# 时间范围: ${report.time_range.start} ~ ${report.time_range.end}`);
    lines.push(`# 总成本: $${report.total_cost.toFixed(4)}`);
    lines.push(`# 总Token数: ${report.total_tokens}`);
    lines.push('');

    // Provider明细
    lines.push('Provider引用ID,Provider名称,质量档位,成本(美元),Token数,调用次数,成功率');
    report.provider_breakdown.forEach((p) => {
      lines.push(
        `${p.provider_ref},${p.provider_name},${p.quality_tier},${p.cost.toFixed(4)},${p.tokens},${p.call_count},${(p.success_rate * 100).toFixed(2)}%`
      );
    });
    lines.push('');

    // 档位汇总
    lines.push('质量档位,成本(美元),Token数,调用次数');
    report.tier_breakdown.forEach((t) => {
      lines.push(`${t.tier},${t.cost.toFixed(4)},${t.tokens},${t.call_count}`);
    });

    return lines.join('\n');
  }

  /**
   * 清空内存中的使用记录
   */
  clearUsageRecords() {
    this.usageRecords = [];
    logger.info('Provider使用记录已清空', { action: 'clear_usage_records' });
  }

  /**
   * 获取当前内存中的使用记录
   */
  getUsageRecords(): ProviderUsageRecord[] {
    return [...this.usageRecords];
  }
}

// 导出单例
export const providerRouter = new ProviderRouter();
