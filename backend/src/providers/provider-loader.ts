import { IProvider, ProviderError, ProviderErrorCode } from './types';

/**
 * Provider白名单配置
 * 艹，这个tm的是安全关键！只有这里列出的handlerKey才能加载！
 * 禁止从数据库动态加载代码，那是SB设计会导致代码注入漏洞！
 */
const ALLOW_LIST: Record<string, () => Promise<any>> = {
  /**
   * 通用HTTP Provider - 支持标准HTTP/HTTPS请求
   */
  GENERIC_HTTP: () => import('./handlers/genericHttp.handler'),

  /**
   * 腾讯云万象（CI）Provider - 图片/视频处理
   */
  TENCENT_CI: () => import('./handlers/tencentCi.handler'),

  /**
   * RunningHub工作流Provider - 第三方工作流编排
   */
  RUNNINGHUB: () => import('./handlers/runninghub.handler'),

  /**
   * 腾讯云云函数（SCF）Provider - Serverless函数调用
   */
  SCF: () => import('./handlers/scf.handler'),
};

/**
 * ProviderLoader - Provider动态加载器
 *
 * 职责：
 * 1. 根据handlerKey从白名单动态加载Provider
 * 2. 缓存已加载的Provider实例（避免重复实例化）
 * 3. 拒绝非白名单的handlerKey（安全机制）
 *
 * 这个tm的类遵循单一职责原则（SOLID-S），只负责加载Provider！
 */
class ProviderLoader {
  /**
   * Provider实例缓存
   * key: handlerKey (例如 "GENERIC_HTTP")
   * value: IProvider实例
   *
   * 乖乖，这个缓存能避免重复实例化，提高性能！
   */
  private cache: Map<string, IProvider>;

  /**
   * 加载统计（用于监控和调试）
   */
  private stats: {
    loadCount: number;
    cacheHitCount: number;
    errorCount: number;
  };

  constructor() {
    this.cache = new Map();
    this.stats = {
      loadCount: 0,
      cacheHitCount: 0,
      errorCount: 0,
    };
  }

  /**
   * 加载Provider实例
   *
   * @param handlerKey - Provider类型（必须在白名单中）
   * @returns Promise<IProvider> - Provider实例
   * @throws ProviderError - 当handlerKey不在白名单或加载失败时
   *
   * 使用示例：
   * ```typescript
   * const provider = await providerLoader.loadProvider('GENERIC_HTTP');
   * const result = await provider.execute(input, taskId);
   * ```
   */
  async loadProvider(handlerKey: string): Promise<IProvider> {
    // 1. 检查缓存（艹，命中缓存就不用重复加载了！）
    const cached = this.cache.get(handlerKey);
    if (cached) {
      this.stats.cacheHitCount++;
      return cached;
    }

    // 2. 检查白名单（这个tm的是安全关键！）
    const importFn = ALLOW_LIST[handlerKey];
    if (!importFn) {
      this.stats.errorCount++;
      throw new ProviderError(
        ProviderErrorCode.ERR_PROVIDER_NOT_ALLOWED,
        `Provider不在白名单中: ${handlerKey}. 允许的类型: ${Object.keys(ALLOW_LIST).join(', ')}`,
        { handlerKey, allowList: Object.keys(ALLOW_LIST) }
      );
    }

    // 3. 动态加载Provider模块
    try {
      this.stats.loadCount++;
      const module = await importFn();

      // 获取默认导出或命名导出
      const ProviderClass = module.default || module[Object.keys(module)[0]];

      if (!ProviderClass) {
        throw new Error(`Provider模块没有导出有效的类: ${handlerKey}`);
      }

      // 4. 实例化Provider
      const provider: IProvider = new ProviderClass();

      // 5. 验证Provider实现（艹，必须有execute方法！）
      if (typeof provider.execute !== 'function') {
        throw new Error(`Provider未实现execute方法: ${handlerKey}`);
      }

      // 6. 可选：执行健康检查
      if (typeof provider.healthCheck === 'function') {
        const isHealthy = await provider.healthCheck();
        if (!isHealthy) {
          throw new ProviderError(
            ProviderErrorCode.ERR_PROVIDER_UNHEALTHY,
            `Provider健康检查失败: ${handlerKey}`,
            { handlerKey }
          );
        }
      }

      // 7. 缓存实例（乖乖，下次就能直接用了！）
      this.cache.set(handlerKey, provider);

      return provider;

    } catch (error: any) {
      this.stats.errorCount++;

      // 如果已经是ProviderError，直接抛出
      if (error instanceof ProviderError) {
        throw error;
      }

      // 否则包装成ProviderError
      throw new ProviderError(
        ProviderErrorCode.ERR_PROVIDER_LOAD_FAILED,
        `Provider加载失败: ${handlerKey}. 错误: ${error.message}`,
        { handlerKey, originalError: error.message, stack: error.stack }
      );
    }
  }

  /**
   * 清除缓存（用于测试或热重载）
   * 艹，生产环境别tm乱用这个方法！
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除指定Provider的缓存
   * @param handlerKey - Provider类型
   */
  clearCacheForProvider(handlerKey: string): void {
    this.cache.delete(handlerKey);
  }

  /**
   * 获取加载统计信息（用于监控）
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cachedProviders: Array.from(this.cache.keys()),
    };
  }

  /**
   * 检查Provider是否在白名单中
   * @param handlerKey - Provider类型
   * @returns boolean - true表示在白名单中
   */
  isAllowed(handlerKey: string): boolean {
    return handlerKey in ALLOW_LIST;
  }

  /**
   * 获取所有允许的Provider类型
   */
  getAllowedProviders(): string[] {
    return Object.keys(ALLOW_LIST);
  }
}

/**
 * 单例实例（遵循单例模式）
 * 整个应用只需要一个ProviderLoader实例
 */
export const providerLoader = new ProviderLoader();

/**
 * 导出类型和类（用于测试）
 */
export { ProviderLoader };
export type { IProvider };
